import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { Search, ThumbsUp, MessageSquare, CheckCircle, ChevronLeft, Plus, Star } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import Seo from '@/components/seo/Seo';
import { ORG_ID, SITE_URL } from '@/lib/organization-schema';

// Build a QAPage JSON-LD graph for the currently-open question. Only
// emitted on the detail view because schema.org QAPage requires a single
// primary question + accepted/suggested answers, not a list. The list
// view ships a CollectionPage instead.
function buildQAPageJsonLd(question, answers) {
  const url = `${SITE_URL}/GeckAnswers?id=${question.id}`;
  const accepted = (answers || []).find((a) => a.is_best_answer);
  const suggested = (answers || []).filter((a) => !a.is_best_answer);
  return [
    {
      '@type': 'QAPage',
      '@id': `${url}#qapage`,
      url,
      mainEntity: {
        '@type': 'Question',
        '@id': `${url}#question`,
        name: question.title,
        text: question.body || question.title,
        upvoteCount: question.upvote_count || 0,
        answerCount: (answers || []).length,
        dateCreated: question.created_date || undefined,
        author: { '@type': 'Person', name: question.created_by || 'Community member' },
        ...(accepted && {
          acceptedAnswer: {
            '@type': 'Answer',
            text: accepted.body,
            upvoteCount: accepted.upvote_count || 0,
            dateCreated: accepted.created_date || undefined,
            author: { '@type': 'Person', name: accepted.created_by || 'Community member' },
          },
        }),
        ...(suggested.length > 0 && {
          suggestedAnswer: suggested.map((a) => ({
            '@type': 'Answer',
            text: a.body,
            upvoteCount: a.upvote_count || 0,
            dateCreated: a.created_date || undefined,
            author: { '@type': 'Person', name: a.created_by || 'Community member' },
          })),
        }),
      },
      isPartOf: { '@id': `${SITE_URL}/#website` },
      publisher: { '@id': ORG_ID },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: 'Geck Answers', item: `${SITE_URL}/GeckAnswers` },
        { '@type': 'ListItem', position: 3, name: question.title, item: url },
      ],
    },
  ];
}

const GECK_ANSWERS_LIST_JSON_LD = [
  {
    '@type': 'CollectionPage',
    '@id': `${SITE_URL}/GeckAnswers#collection`,
    name: 'Geck Answers — Crested Gecko Q&A',
    url: `${SITE_URL}/GeckAnswers`,
    description:
      'Community-driven crested gecko Q&A. Search questions on nutrition, health, housing, breeding, morphs, juveniles, adults, hatchlings, equipment, and genetics — or ask your own.',
    isPartOf: { '@id': `${SITE_URL}/#website` },
    publisher: { '@id': ORG_ID },
    about: {
      '@type': 'Thing',
      name: 'Crested gecko',
      alternateName: 'Correlophus ciliatus',
    },
  },
  {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Geck Answers', item: `${SITE_URL}/GeckAnswers` },
    ],
  },
];

const C = { forest: '#e2e8f0', sage: '#10b981', paleSage: 'rgba(16,185,129,0.1)', warmWhite: '#020617', gold: '#f59e0b', goldLight: 'rgba(245,158,11,0.15)', slate: '#cbd5e1', muted: '#64748b', cardBg: '#0f172a', border: 'rgba(51,65,85,0.5)' };
const TAGS = ['Nutrition', 'Health', 'Housing', 'Breeding', 'Morphs', 'Juveniles', 'Adults', 'Hatchlings', 'Equipment', 'Genetics'];

export default function GeckAnswers() {
  const auth = useAuth?.() || {};
  const [view, setView] = useState('list'); // list | detail | ask
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState(null);
  const [tab, setTab] = useState('recent');
  const [newQ, setNewQ] = useState({ title: '', body: '', tags: [] });
  const [newAnswer, setNewAnswer] = useState('');

  useEffect(() => { loadQuestions(); }, []);

  const loadQuestions = async () => {
    setLoading(true);
    const { data } = await supabase.from('questions').select('*').order('created_date', { ascending: false });
    setQuestions(data || []);
    setLoading(false);
  };

  const openQuestion = async (q) => {
    setSelected(q);
    setView('detail');
    const { data } = await supabase.from('answers').select('*').eq('question_id', q.id).order('upvote_count', { ascending: false });
    setAnswers(data || []);
    // Increment view count
    supabase.from('questions').update({ view_count: (q.view_count || 0) + 1 }).eq('id', q.id).then(() => {});
  };

  const submitQuestion = async () => {
    if (!newQ.title.trim()) return;
    await supabase.from('questions').insert({ title: newQ.title, body: newQ.body, tags: newQ.tags, author_id: auth.user?.id, created_by: auth.user?.email });
    setNewQ({ title: '', body: '', tags: [] });
    setView('list');
    loadQuestions();
  };

  const submitAnswer = async () => {
    if (!newAnswer.trim() || !selected) return;
    await supabase.from('answers').insert({ question_id: selected.id, body: newAnswer, author_id: auth.user?.id, created_by: auth.user?.email });
    setNewAnswer('');
    openQuestion(selected);
  };

  const upvoteQuestion = async (q) => {
    if (!auth.user) return;
    await supabase.from('questions').update({ upvote_count: (q.upvote_count || 0) + 1 }).eq('id', q.id);
    loadQuestions();
  };

  const upvoteAnswer = async (a) => {
    if (!auth.user) return;
    await supabase.from('answers').update({ upvote_count: (a.upvote_count || 0) + 1 }).eq('id', a.id);
    if (selected) openQuestion(selected);
  };

  const markBestAnswer = async (a) => {
    if (!auth.user || selected?.created_by !== auth.user.email) return;
    await supabase.from('answers').update({ is_best_answer: false }).eq('question_id', selected.id);
    await supabase.from('answers').update({ is_best_answer: true }).eq('id', a.id);
    await supabase.from('questions').update({ best_answer_id: a.id, status: 'answered' }).eq('id', selected.id);
    openQuestion(selected);
    loadQuestions();
  };

  const filtered = questions.filter(q => {
    if (search && !q.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (tagFilter && !(q.tags || []).some(t => t.toLowerCase() === tagFilter.toLowerCase())) return false;
    return true;
  }).sort((a, b) => tab === 'trending' ? (b.view_count + b.upvote_count * 3) - (a.view_count + a.upvote_count * 3) : 0);

  const featured = filtered.filter(q => q.is_featured);
  const regular = filtered.filter(q => !q.is_featured);

  // ─── ASK VIEW ───
  if (view === 'ask') {
    return (
      <div className="min-h-screen p-6" style={{ backgroundColor: C.warmWhite, fontFamily: "'DM Sans', sans-serif" }}>
        <Seo
          title="Ask a Crested Gecko Question"
          description="Post a new crested gecko question to the Geck Answers community."
          path="/GeckAnswers"
          noIndex
        />
        <div className="max-w-2xl mx-auto">
          <button onClick={() => setView('list')} className="flex items-center gap-1 text-sm mb-4" style={{ color: C.sage }}><ChevronLeft size={16} /> Back</button>
          <h1 className="text-3xl mb-6" style={{ fontFamily: "'DM Serif Display', serif", color: C.forest }}>Ask a Question</h1>
          <div className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-wider block mb-1" style={{ color: C.muted }}>Title ({newQ.title.length}/150)</label>
              <input value={newQ.title} onChange={e => setNewQ(p => ({ ...p, title: e.target.value.slice(0, 150) }))} placeholder="What's your question?"
                className="w-full rounded-xl border px-4 py-3 text-base" style={{ borderColor: C.border, color: C.slate }} />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider block mb-1" style={{ color: C.muted }}>Details (optional, supports markdown)</label>
              <textarea value={newQ.body} onChange={e => setNewQ(p => ({ ...p, body: e.target.value }))} rows={6} placeholder="Add context, what you've already tried..."
                className="w-full rounded-xl border px-4 py-3 text-sm" style={{ borderColor: C.border, color: C.slate }} />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider block mb-1" style={{ color: C.muted }}>Tags (max 5)</label>
              <div className="flex flex-wrap gap-1.5">
                {TAGS.map(t => (
                  <button key={t} onClick={() => setNewQ(p => ({ ...p, tags: p.tags.includes(t) ? p.tags.filter(x => x !== t) : p.tags.length < 5 ? [...p.tags, t] : p.tags }))}
                    className="px-2.5 py-1 rounded-full text-xs transition" style={{ backgroundColor: newQ.tags.includes(t) ? C.sage : C.paleSage, color: newQ.tags.includes(t) ? 'white' : C.slate }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={submitQuestion} className="px-6 py-2.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: C.sage }}>Post Question</button>
          </div>
        </div>
      </div>
    );
  }

  // ─── DETAIL VIEW ───
  if (view === 'detail' && selected) {
    const bestAnswer = answers.find(a => a.is_best_answer);
    const otherAnswers = answers.filter(a => !a.is_best_answer);
    const isAuthor = auth.user?.email === selected.created_by;

    return (
      <div className="min-h-screen p-6" style={{ backgroundColor: C.warmWhite, fontFamily: "'DM Sans', sans-serif" }}>
        <Seo
          title={`${selected.title} — Crested Gecko Q&A`}
          description={(selected.body || selected.title).slice(0, 200)}
          path={`/GeckAnswers?id=${selected.id}`}
          imageAlt={`Crested gecko question — ${selected.title}`}
          keywords={[
            'crested gecko question',
            'crested gecko answer',
            ...(selected.tags || []).map((t) => `crested gecko ${t.toLowerCase()}`),
          ]}
          jsonLd={buildQAPageJsonLd(selected, answers)}
        />
        <div className="max-w-3xl mx-auto">
          <button onClick={() => { setView('list'); setSelected(null); }} className="flex items-center gap-1 text-sm mb-4" style={{ color: C.sage }}><ChevronLeft size={16} /> Back to questions</button>

          {/* Question */}
          <div className="rounded-xl border p-6 mb-6" style={{ borderColor: C.border, backgroundColor: C.cardBg }}>
            <div className="flex gap-4">
              <div className="flex flex-col items-center gap-1 shrink-0">
                <button onClick={() => upvoteQuestion(selected)} className="p-1 rounded hover:bg-gray-100 transition"><ThumbsUp size={18} style={{ color: C.sage }} /></button>
                <span className="text-sm font-semibold" style={{ color: C.forest }}>{selected.upvote_count || 0}</span>
              </div>
              <div className="flex-1">
                <h1 className="text-2xl mb-3" style={{ fontFamily: "'DM Serif Display', serif", color: C.forest }}>{selected.title}</h1>
                {selected.body && <div className="prose prose-sm max-w-none mb-3" style={{ color: C.slate }}><ReactMarkdown>{selected.body}</ReactMarkdown></div>}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {(selected.tags || []).map(t => <span key={t} className="text-xs rounded-full px-2 py-0.5" style={{ backgroundColor: C.paleSage, color: C.sage }}>{t}</span>)}
                </div>
                <div className="flex items-center gap-3 text-xs" style={{ color: C.muted }}>
                  <span>{selected.view_count || 0} views</span>
                  <span>{selected.created_date ? formatDistanceToNow(new Date(selected.created_date), { addSuffix: true }) : ''}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Best answer */}
          {bestAnswer && (
            <div className="rounded-xl border p-6 mb-4" style={{ borderColor: C.sage, backgroundColor: C.paleSage + '88' }}>
              <div className="flex items-center gap-2 mb-3">
                <Star size={16} style={{ color: C.gold }} fill={C.gold} />
                <span className="text-xs font-semibold rounded-full px-2 py-0.5" style={{ backgroundColor: C.goldLight, color: '#633806' }}>Best Answer</span>
              </div>
              <div className="prose prose-sm max-w-none" style={{ color: C.slate }}><ReactMarkdown>{bestAnswer.body}</ReactMarkdown></div>
              <div className="flex items-center gap-3 mt-3">
                <button onClick={() => upvoteAnswer(bestAnswer)} className="flex items-center gap-1 text-xs" style={{ color: C.sage }}><ThumbsUp size={13} /> {bestAnswer.upvote_count || 0}</button>
                <span className="text-xs" style={{ color: C.muted }}>{bestAnswer.created_date ? formatDistanceToNow(new Date(bestAnswer.created_date), { addSuffix: true }) : ''}</span>
              </div>
            </div>
          )}

          {/* Other answers */}
          <h3 className="text-sm font-medium mb-3" style={{ color: C.muted }}>{answers.length} answer{answers.length !== 1 ? 's' : ''}</h3>
          {otherAnswers.map(a => (
            <div key={a.id} className="rounded-xl border p-5 mb-3" style={{ borderColor: C.border, backgroundColor: C.cardBg }}>
              <div className="prose prose-sm max-w-none" style={{ color: C.slate }}><ReactMarkdown>{a.body}</ReactMarkdown></div>
              <div className="flex items-center gap-3 mt-3">
                <button onClick={() => upvoteAnswer(a)} className="flex items-center gap-1 text-xs" style={{ color: C.sage }}><ThumbsUp size={13} /> {a.upvote_count || 0}</button>
                <span className="text-xs" style={{ color: C.muted }}>{a.created_date ? formatDistanceToNow(new Date(a.created_date), { addSuffix: true }) : ''}</span>
                {isAuthor && !a.is_best_answer && (
                  <button onClick={() => markBestAnswer(a)} className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: C.goldLight, color: '#633806' }}>Mark as best answer</button>
                )}
              </div>
            </div>
          ))}

          {/* Add answer */}
          {auth.user ? (
            <div className="rounded-xl border p-5 mt-4" style={{ borderColor: C.border, backgroundColor: C.cardBg }}>
              <h3 className="text-sm font-medium mb-2" style={{ color: C.forest }}>Your Answer</h3>
              <textarea value={newAnswer} onChange={e => setNewAnswer(e.target.value)} rows={4} placeholder="Share your knowledge... (markdown supported)"
                className="w-full rounded-lg border px-3 py-2 text-sm mb-3" style={{ borderColor: C.border, color: C.slate }} />
              <button onClick={submitAnswer} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: C.sage }}>Post Answer</button>
            </div>
          ) : (
            <p className="text-sm text-center py-4" style={{ color: C.muted }}>Sign in to answer this question</p>
          )}
        </div>
      </div>
    );
  }

  // ─── LIST VIEW ───
  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: C.warmWhite, fontFamily: "'DM Sans', sans-serif" }}>
      <Seo
        title="Geck Answers — Crested Gecko Q&A"
        description="Community-driven crested gecko Q&A. Browse questions on nutrition, health, housing, breeding, morphs, juveniles, adults, hatchlings, equipment, and genetics — or ask your own."
        path="/GeckAnswers"
        imageAlt="Geck Answers — crested gecko Q&A community"
        keywords={[
          'crested gecko questions',
          'crested gecko answers',
          'crested gecko Q&A',
          'gecko help',
          'crestie advice',
        ]}
        jsonLd={GECK_ANSWERS_LIST_JSON_LD}
      />
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="text-3xl" style={{ fontFamily: "'DM Serif Display', serif", color: C.forest }}>Geck Answers</h1>
          {auth.user && (
            <button onClick={() => setView('ask')} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: C.sage }}>
              <Plus size={16} /> Ask a Question
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.muted }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search questions..."
            className="w-full rounded-xl border pl-10 pr-4 py-2.5 text-sm" style={{ borderColor: C.border, color: C.slate }} />
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {TAGS.map(t => (
            <button key={t} onClick={() => setTagFilter(tagFilter === t ? null : t)}
              className="px-2.5 py-1 rounded-full text-xs transition" style={{ backgroundColor: tagFilter === t ? C.sage : C.paleSage, color: tagFilter === t ? 'white' : C.slate }}>
              {t}
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4">
          {['recent', 'trending'].map(t => (
            <button key={t} onClick={() => setTab(t)} className="px-3 py-1.5 rounded-lg text-sm capitalize transition"
              style={{ backgroundColor: tab === t ? C.sage : 'transparent', color: tab === t ? 'white' : C.muted }}>
              {t}
            </button>
          ))}
        </div>

        {/* Question list */}
        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="animate-pulse rounded-xl h-24" style={{ backgroundColor: C.paleSage }} />)}</div>
        ) : (
          <div className="space-y-3">
            {[...featured, ...regular].map(q => (
              <div key={q.id} onClick={() => openQuestion(q)}
                className="rounded-xl border p-4 cursor-pointer transition hover:shadow-sm"
                style={{ borderColor: q.is_featured ? C.sage : 'rgba(78,124,78,0.15)', backgroundColor: C.cardBg }}>
                <div className="flex gap-3">
                  <div className="flex flex-col items-center gap-0.5 shrink-0 min-w-[40px]">
                    <span className="text-lg font-semibold" style={{ color: C.forest }}>{q.upvote_count || 0}</span>
                    <span className="text-xs" style={{ color: C.muted }}>votes</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {q.is_featured && <Star size={12} style={{ color: C.gold }} fill={C.gold} />}
                      <h3 className="text-sm font-semibold truncate" style={{ color: C.forest }}>{q.title}</h3>
                    </div>
                    {q.body && <p className="text-xs line-clamp-2 mb-2" style={{ color: C.muted }}>{q.body.slice(0, 120)}...</p>}
                    <div className="flex items-center gap-2 flex-wrap">
                      {(q.tags || []).map(t => <span key={t} className="text-xs rounded-full px-1.5 py-0.5" style={{ backgroundColor: C.paleSage, color: C.sage }}>{t}</span>)}
                      <span className="text-xs flex items-center gap-1" style={{ color: C.muted }}>
                        <MessageSquare size={11} /> {q.view_count || 0} views
                      </span>
                      {q.best_answer_id && (
                        <span className="text-xs rounded-full px-2 py-0.5 flex items-center gap-1" style={{ backgroundColor: C.paleSage, color: C.sage }}>
                          <CheckCircle size={11} /> Answered
                        </span>
                      )}
                      <span className="text-xs ml-auto" style={{ color: C.muted }}>
                        {q.created_date ? formatDistanceToNow(new Date(q.created_date), { addSuffix: true }) : ''}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-12">
                <MessageSquare size={32} className="mx-auto mb-2" style={{ color: C.muted }} />
                <p className="text-sm" style={{ color: C.muted }}>No questions found</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
