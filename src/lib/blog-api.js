/**
 * Blog backend operations. Thin wrappers around the entity client that
 * keep status transitions, slug uniqueness, log writes, AI generation,
 * and reading-time/word-count derivation all in one place ,  so every
 * surface (admin editor, AI generator, mass actions) goes through the
 * same path and produces consistent audit trail entries in blog_logs.
 *
 * Public API:
 *   createBlogPost(payload)
 *   updateBlogPost(id, patch)
 *   publishBlogPostNow(id)
 *   scheduleBlogPost(id, scheduled_at)
 *   cancelScheduledBlogPost(id)
 *   archiveBlogPost(id)
 *   processScheduledBlogPosts()           // client-side trigger; the
 *                                         // pg_cron job in the migration
 *                                         // is the source of truth.
 *   generateBlogPost(input)               // calls InvokeLLM, returns
 *                                         // structured payload + saved
 *                                         // draft id.
 *   logBlogEvent(event_type, fields?)     // append to blog_logs
 */
import { BlogPost, BlogLog, BlogCategory, BlogTag } from '@/entities/all';
import { InvokeLLM } from '@/lib/invokeLlm';
import {
  slugify,
  countWords,
  readingTimeMinutes,
  markdownToHtml,
} from '@/lib/blog-helpers';

/* -------------------------------------------------------------------------- */
/* Logging                                                                    */
/* -------------------------------------------------------------------------- */

export async function logBlogEvent(event_type, fields = {}) {
  try {
    await BlogLog.create({
      event_type,
      related_post_id: fields.related_post_id || null,
      status: fields.status || 'success',
      message: fields.message || null,
    });
  } catch (err) {
    // Logging failure must not break the user-visible action.
    console.warn('[blog-api] logBlogEvent failed:', err);
  }
}

/* -------------------------------------------------------------------------- */
/* Slug enforcement                                                           */
/* -------------------------------------------------------------------------- */

async function ensureUniqueSlug(desired, ignoreId = null) {
  const base = slugify(desired) || 'post';
  let candidate = base;
  let n = 1;
  // Try up to 200 variants then bail.
  while (n < 200) {
    const existing = await BlogPost.filter({ slug: candidate });
    const conflict = (existing || []).find((p) => p.id !== ignoreId);
    if (!conflict) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
  }
  throw new Error(`Could not find a unique slug starting with "${base}"`);
}

/* -------------------------------------------------------------------------- */
/* Derived fields                                                             */
/* -------------------------------------------------------------------------- */

function withDerivedContent(payload) {
  const md = payload.content_markdown || '';
  const html = md ? markdownToHtml(md) : (payload.content_html || '');
  return {
    ...payload,
    content_html: html,
    word_count: countWords(md || html),
    reading_time_minutes: readingTimeMinutes(md || html),
  };
}

/* -------------------------------------------------------------------------- */
/* Mutations                                                                  */
/* -------------------------------------------------------------------------- */

export async function createBlogPost(payload = {}) {
  const slug = await ensureUniqueSlug(payload.slug || payload.title || 'untitled-post');
  const draft = withDerivedContent({
    status: 'draft',
    ...payload,
    slug,
  });
  const created = await BlogPost.create(draft);
  await logBlogEvent('post_created', { related_post_id: created.id, message: created.title });
  return created;
}

export async function updateBlogPost(id, patch = {}) {
  let body = { ...patch };
  if (patch.slug !== undefined) {
    body.slug = await ensureUniqueSlug(patch.slug, id);
  }
  // If markdown changed, re-derive html / counts.
  if (patch.content_markdown !== undefined || patch.content_html !== undefined) {
    body = withDerivedContent(body);
  }
  const updated = await BlogPost.update(id, body);
  await logBlogEvent('post_updated', { related_post_id: id, message: updated?.title });
  return updated;
}

export async function publishBlogPostNow(id) {
  try {
    const updated = await BlogPost.update(id, {
      status: 'published',
      published_at: new Date().toISOString(),
      scheduled_at: null,
    });
    await logBlogEvent('post_published', { related_post_id: id, message: updated?.title });
    return updated;
  } catch (err) {
    await logBlogEvent('post_publish_failed', {
      related_post_id: id,
      status: 'error',
      message: err.message || String(err),
    });
    throw err;
  }
}

export async function scheduleBlogPost(id, scheduled_at) {
  if (!scheduled_at) throw new Error('scheduled_at is required');
  const ts = new Date(scheduled_at);
  if (isNaN(ts.getTime())) throw new Error('Invalid scheduled_at');
  const updated = await BlogPost.update(id, {
    status: 'scheduled',
    scheduled_at: ts.toISOString(),
    published_at: null,
  });
  await logBlogEvent('post_scheduled', {
    related_post_id: id,
    message: `Scheduled for ${ts.toISOString()}`,
  });
  return updated;
}

export async function cancelScheduledBlogPost(id) {
  const updated = await BlogPost.update(id, {
    status: 'draft',
    scheduled_at: null,
  });
  await logBlogEvent('post_updated', {
    related_post_id: id,
    message: 'Schedule cancelled ,  back to draft',
  });
  return updated;
}

export async function archiveBlogPost(id) {
  const updated = await BlogPost.update(id, { status: 'archived' });
  await logBlogEvent('post_archived', { related_post_id: id, message: updated?.title });
  return updated;
}

export async function duplicateBlogPost(post) {
  if (!post) throw new Error('post is required');
  const baseSlug = slugify(`${post.title || 'post'} copy`);
  const slug = await ensureUniqueSlug(baseSlug);
  const copy = withDerivedContent({
    title: `${post.title || 'Untitled'} (copy)`,
    slug,
    excerpt: post.excerpt,
    content_markdown: post.content_markdown,
    content_html: post.content_html,
    status: 'draft',
    target_keyword: post.target_keyword,
    category_id: post.category_id,
    tag_ids: post.tag_ids || [],
    author_name: post.author_name,
    author_bio: post.author_bio,
    author_avatar_url: post.author_avatar_url,
    featured_image_url: post.featured_image_url,
    featured_image_alt: post.featured_image_alt,
    meta_title: post.meta_title,
    meta_description: post.meta_description,
    canonical_url: null, // never duplicate the canonical
    scheduled_at: null,
    published_at: null,
  });
  const created = await BlogPost.create(copy);
  await logBlogEvent('post_created', {
    related_post_id: created.id,
    message: `Duplicated from "${post.title || ''}"`,
  });
  return created;
}

/* -------------------------------------------------------------------------- */
/* Scheduling helper (client-side trigger)                                    */
/* -------------------------------------------------------------------------- */
//
// The pg_cron job runs every minute, so this is a safety net the admin
// can hit manually if they want a publish to happen *right now* without
// waiting up to 60s for cron. It mimics the SQL function: any post with
// status=scheduled and scheduled_at<=now() is promoted to published.
//
export async function processScheduledBlogPosts() {
  const due = await BlogPost.filter({ status: 'scheduled' }, '-scheduled_at', 100);
  const nowMs = Date.now();
  const toPromote = (due || []).filter(
    (p) => p.scheduled_at && new Date(p.scheduled_at).getTime() <= nowMs
  );
  let promoted = 0;
  for (const post of toPromote) {
    try {
      await publishBlogPostNow(post.id);
      promoted += 1;
    } catch (err) {
      console.error('[blog-api] processScheduledBlogPosts publish failed:', err);
    }
  }
  return { promoted, considered: toPromote.length };
}

/* -------------------------------------------------------------------------- */
/* AI generation                                                              */
/* -------------------------------------------------------------------------- */

const LENGTH_TARGETS = {
  short:  { words: 600,  label: 'Short (~600 words)' },
  medium: { words: 1100, label: 'Medium (~1,100 words)' },
  long:   { words: 1800, label: 'Long (~1,800 words)' },
  extra:  { words: 2600, label: 'Extra long (~2,600 words)' },
};

export const AI_LENGTH_OPTIONS = LENGTH_TARGETS;

const TONES = [
  'helpful', 'authoritative', 'friendly', 'practical',
  'enthusiastic', 'analytical', 'conversational', 'professional',
];
export const AI_TONE_OPTIONS = TONES;

const SEARCH_INTENTS = [
  { id: 'informational', label: 'Informational' },
  { id: 'commercial',    label: 'Commercial investigation' },
  { id: 'transactional', label: 'Transactional' },
  { id: 'navigational',  label: 'Navigational' },
];
export const AI_INTENT_OPTIONS = SEARCH_INTENTS;

const AI_RESPONSE_SCHEMA = {
  type: 'object',
  required: [
    'title_options', 'recommended_title', 'slug', 'excerpt', 'outline',
    'full_article_markdown', 'meta_title', 'meta_description',
    'suggested_category', 'suggested_tags',
    'featured_image_prompt', 'featured_image_alt_text',
  ],
  properties: {
    title_options:           { type: 'array',  items: { type: 'string' }, minItems: 3 },
    recommended_title:       { type: 'string' },
    slug:                    { type: 'string' },
    excerpt:                 { type: 'string' },
    outline:                 { type: 'array',  items: { type: 'string' } },
    full_article_markdown:   { type: 'string' },
    meta_title:              { type: 'string' },
    meta_description:        { type: 'string' },
    suggested_category:      { type: 'string' },
    suggested_tags:          { type: 'array',  items: { type: 'string' } },
    featured_image_prompt:   { type: 'string' },
    featured_image_alt_text: { type: 'string' },
  },
};

function buildAiPrompt(input, categories, tags) {
  const target = LENGTH_TARGETS[input.length] || LENGTH_TARGETS.medium;
  const safeList = (arr) => Array.isArray(arr) ? arr.filter(Boolean).join(', ') : '';

  return `You are an expert SEO blog writer for a niche audience. Write a complete blog post that follows the brief below and call back ONLY with the JSON object the response schema requires ,  no extra prose, no markdown wrapper.

# Brief

- Topic: ${input.topic || '(unspecified)'}
- Target keyword: ${input.target_keyword || '(none)'}
- Secondary keywords: ${safeList(input.secondary_keywords) || '(none)'}
- Search intent: ${input.search_intent || 'informational'}
- Target audience: ${input.target_audience || '(general)'}
- Tone: ${input.tone || 'helpful'}
- Approximate length: ${target.label}
- Suggested category (existing list, pick the closest or invent a new one): ${safeList(categories) || '(none yet)'}
- Suggested tags (existing list, pick from these or invent new ones): ${safeList(tags) || '(none yet)'}
- Call to action: ${input.call_to_action || '(none)'}
${input.custom_instructions ? `- Extra instructions: ${input.custom_instructions}` : ''}

# Writing rules (strict)

1. NEVER invent statistics, percentages, study citations, or fake testimonials. Only state numbers if you are sure they are widely known and verifiable; otherwise speak qualitatively ("many breeders find…", "in our experience…").
2. Avoid keyword stuffing. The target keyword should appear naturally ,  once in the title, once in the first 100 words, and 2–4 more times across the body.
3. Match the search intent above ,  do not write a sales page if the intent is informational.
4. Use clear H2/H3 headings (markdown ## / ###), short paragraphs (max 4 sentences), and bullet lists where they help.
5. Open with a 2–3 sentence intro that names the problem and previews the answer.
6. Close with a useful conclusion paragraph and exactly ONE clear call to action linking back to the brand or to a relevant page.
7. Write for humans first. No fluff, no AI-tells like "in today's fast-paced world".
8. Output a complete article that hits roughly ${target.words} words.

# Required output (filled into the JSON schema)

- title_options: 3–5 distinct, click-worthy titles (≤ 70 chars).
- recommended_title: best of the above.
- slug: kebab-case, ≤ 60 chars, contains the target keyword if natural.
- excerpt: 140–160 char meta-description-style summary.
- outline: 5–10 H2-level headings as bullets.
- full_article_markdown: the full body in markdown using ## / ### headings, ${target.words} words give-or-take. Begin with the intro paragraph (no H1 ,  the renderer adds that).
- meta_title: ≤ 60 chars, contains the target keyword.
- meta_description: 150–160 chars, contains the target keyword.
- suggested_category: a single category name (string).
- suggested_tags: 3–6 short tag names.
- featured_image_prompt: a vivid, photorealistic image-generation prompt for the post hero (no text rendering, no logos).
- featured_image_alt_text: short descriptive alt text (≤ 125 chars) describing the suggested hero image.`;
}

/**
 * generateBlogPost(input)
 *
 * Calls the InvokeLLM edge function, parses the response, then saves the
 * result as a draft blog post. Returns { post, ai } so the UI can show
 * the title options + outline alongside the saved draft.
 *
 * input shape:
 *   topic, target_keyword, secondary_keywords[], search_intent,
 *   target_audience, tone, length, category_id, tag_ids[],
 *   call_to_action, custom_instructions
 */
export async function generateBlogPost(input = {}) {
  const [allCategories, allTags] = await Promise.all([
    BlogCategory.list().catch(() => []),
    BlogTag.list().catch(() => []),
  ]);
  const activeCategoryNames = (allCategories || []).filter((c) => c.is_active).map((c) => c.name);
  const activeTagNames = (allTags || []).filter((t) => t.is_active).map((t) => t.name);

  const prompt = buildAiPrompt(input, activeCategoryNames, activeTagNames);
  const ai = await InvokeLLM({
    prompt,
    response_json_schema: AI_RESPONSE_SCHEMA,
    max_tokens: 8192,
  });

  // Resolve suggested category to an id from the existing list, if a match.
  let category_id = input.category_id || null;
  if (!category_id && ai?.suggested_category) {
    const match = (allCategories || []).find(
      (c) => c.is_active && c.name?.toLowerCase() === String(ai.suggested_category).toLowerCase()
    );
    if (match) category_id = match.id;
  }

  // Resolve suggested tags to existing ids; ignore unmatched (admin can
  // create them later in the Tags screen).
  let tag_ids = Array.isArray(input.tag_ids) && input.tag_ids.length
    ? [...input.tag_ids]
    : [];
  if (Array.isArray(ai?.suggested_tags)) {
    for (const name of ai.suggested_tags) {
      const match = (allTags || []).find(
        (t) => t.is_active && t.name?.toLowerCase() === String(name).toLowerCase()
      );
      if (match && !tag_ids.includes(match.id)) tag_ids.push(match.id);
    }
  }

  const slug = ai?.slug ? slugify(ai.slug) : slugify(ai?.recommended_title || input.topic || 'ai-draft');

  const draft = withDerivedContent({
    title: ai?.recommended_title || ai?.title_options?.[0] || input.topic || 'AI draft',
    slug, // ensureUniqueSlug runs in createBlogPost
    excerpt: ai?.excerpt || '',
    content_markdown: ai?.full_article_markdown || '',
    status: 'draft',
    target_keyword: input.target_keyword || null,
    category_id,
    tag_ids,
    meta_title: ai?.meta_title || ai?.recommended_title || '',
    meta_description: ai?.meta_description || ai?.excerpt || '',
    featured_image_alt: ai?.featured_image_alt_text || '',
  });

  // createBlogPost dedupes the slug + writes a 'post_created' log.
  const post = await createBlogPost(draft);
  // Add a richer 'post_ai_generated' entry on top.
  await logBlogEvent('post_ai_generated', {
    related_post_id: post.id,
    message: `AI draft on "${input.topic || ai?.recommended_title || 'untitled'}" (${input.length || 'medium'})`,
  });
  return { post, ai };
}
