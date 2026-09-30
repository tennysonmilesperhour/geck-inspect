-- Applied by hand on 30 Sep 2026 (feature audit Phase 0.7b).
--
-- csp-report stored each blocked address in full, and 21 of the 29
-- stored reports carried a query string holding a member's email
-- address. The function now keeps the path only (csp-report v10); this
-- clears the query strings and fragments already stored. Afterwards no
-- csp-report row held a query string or an email address.
update public.error_logs
   set message = regexp_replace(message, '[?#].*$', ''),
       url = regexp_replace(url, '[?#].*$', ''),
       context = context
         || jsonb_build_object('blocked_uri', regexp_replace(coalesce(context->>'blocked_uri', ''), '[?#].*$', ''))
         || case when context ? 'source_file' and context->>'source_file' is not null
                 then jsonb_build_object('source_file', regexp_replace(context->>'source_file', '[?#].*$', ''))
                 else '{}'::jsonb end
 where created_by = 'csp-report'
   and (message ~ '[?#]' or url ~ '[?#]' or context->>'blocked_uri' ~ '[?#]' or context->>'source_file' ~ '[?#]');
