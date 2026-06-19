-- seed-presets.sql — seed provider_presets from PRESET_PROVIDERS
-- (src/lib/providers/presets.ts). Run AFTER 0001_init.sql and
-- 0002_admin_managed_keys.sql.
--
-- `on conflict (id) do nothing` so re-running is safe and never clobbers
-- admin edits made via the (Phase D) admin UI. To force a refresh of a
-- specific preset, delete its row first or change the conflict clause.

insert into public.provider_presets
  (id, display_name, base_url, models, default_model, enabled, sort_order)
values
  (
    'openai',
    'OpenAI',
    'https://api.openai.com/v1',
    '["gpt-5.5","gpt-5.4","gpt-5.4-mini","gpt-5.4-nano"]'::jsonb,
    'gpt-5.4-mini',
    true,
    1
  ),
  (
    'gemini',
    'Google Gemini',
    'https://generativelanguage.googleapis.com/v1beta/openai/',
    '["gemini-3.5-flash","gemini-3.1-pro-preview","gemini-3.1-flash-lite"]'::jsonb,
    'gemini-3.5-flash',
    true,
    2
  ),
  (
    'qwen',
    'Qwen (DashScope)',
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
    '["qwen3.7-max","qwen3.7-plus","qwen3.6-flash"]'::jsonb,
    'qwen3.6-flash',
    true,
    3
  ),
  (
    'zhipu',
    'Zhipu Z.AI',
    'https://open.bigmodel.cn/api/paas/v4',
    '["glm-5.1","glm-5","glm-4.7","glm-4.7-flash"]'::jsonb,
    'glm-4.7-flash',
    true,
    4
  ),
  (
    'deepseek',
    'DeepSeek',
    'https://api.deepseek.com/v1',
    '["deepseek-v4-pro","deepseek-v4-flash"]'::jsonb,
    'deepseek-v4-flash',
    true,
    5
  ),
  (
    'anthropic',
    'Anthropic Claude',
    'https://api.anthropic.com/v1/',
    '["claude-opus-4-8","claude-sonnet-4-6","claude-haiku-4-5"]'::jsonb,
    'claude-sonnet-4-6',
    true,
    6
  )
on conflict (id) do nothing;
