import LoadingSpinner from '../components/LoadingSpinner';
import { useEffect, useState } from 'react';
import { useLLMSettings, useOllamaModels, useUpdateLLMSettings } from '../hooks/queries';
import FormField from '../components/FormField';

interface Props {
  projectId: string;
}

const ANTHROPIC_MODELS = [
  'claude-sonnet-4-6',
  'claude-opus-4-8',
  'claude-haiku-4-5-20251001',
];

/** LLM provider and model configuration. API keys stay as env vars. */
export default function SettingsView(_props: Props) {
  const { data: settings, isLoading, isError } = useLLMSettings();
  const { data: ollamaModels = [] } = useOllamaModels();
  const update = useUpdateLLMSettings();

  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const [ollamaUrl, setOllamaUrl] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings) {
      setProvider(settings.provider ?? 'anthropic');
      setModel(settings.model ?? '');
      setOllamaUrl(settings.ollama_url ?? '');
    }
  }, [settings]);

  function save() {
    update.mutate(
      { provider, model, ollama_url: ollamaUrl },
      { onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2000); } },
    );
  }

  if (isLoading) return <LoadingSpinner message="Loading settings…" />;
  if (isError) return <div className="center-state">Could not load settings. Is the backend running?</div>;

  const isOllama = provider === 'ollama';

  return (
    <div className="view">
      <div className="panel settings-panel">
        <div className="panel-header">
          <div>
            <h2>Settings</h2>
            <p className="muted">Configure the AI provider and model. API keys are set via environment variables.</p>
          </div>
        </div>

        <section className="settings-section">
          <h3 className="settings-section-title">AI provider</h3>

          <div className="provider-cards">
            <label className={`provider-card${provider === 'anthropic' ? ' selected' : ''}`}>
              <input
                type="radio"
                name="provider"
                value="anthropic"
                checked={provider === 'anthropic'}
                onChange={() => { setProvider('anthropic'); setModel(ANTHROPIC_MODELS[0]); }}
              />
              <div className="provider-card-body">
                <div className="provider-name">Anthropic Claude</div>
                <div className="provider-desc">Best quality. Requires <code>ANTHROPIC_API_KEY</code> env var.</div>
                {settings?.anthropic_configured ? (
                  <span className="provider-status ok">✓ API key configured</span>
                ) : (
                  <span className="provider-status warn">⚠ ANTHROPIC_API_KEY not set</span>
                )}
              </div>
            </label>

            <label className={`provider-card${provider === 'ollama' ? ' selected' : ''}`}>
              <input
                type="radio"
                name="provider"
                value="ollama"
                checked={provider === 'ollama'}
                onChange={() => { setProvider('ollama'); setModel(ollamaModels[0]?.name ?? ''); }}
              />
              <div className="provider-card-body">
                <div className="provider-name">Ollama (local)</div>
                <div className="provider-desc">Run models locally. No API key needed. Qwen2.5-Coder or Qwen3 recommended.</div>
                {ollamaModels.length > 0 ? (
                  <span className="provider-status ok">✓ {ollamaModels.length} model{ollamaModels.length > 1 ? 's' : ''} installed</span>
                ) : (
                  <span className="provider-status warn">Ollama not reachable at {ollamaUrl || 'http://localhost:11434'}</span>
                )}
              </div>
            </label>
          </div>

          {isOllama && (
            <FormField id="ollama-url" label="Ollama URL">
              <input
                id="ollama-url"
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                placeholder="http://localhost:11434"
              />
            </FormField>
          )}
        </section>

        <section className="settings-section">
          <h3 className="settings-section-title">Model</h3>

          {isOllama ? (
            <FormField id="ollama-model" label="Ollama model">
              {ollamaModels.length > 0 ? (
                <select
                  id="ollama-model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  <option value="">— select —</option>
                  {ollamaModels.map((m) => (
                    <option key={m.name} value={m.name}>
                      {m.name}
                      {m.size ? ` (${(m.size / 1e9).toFixed(1)} GB)` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="ollama-model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="qwen3:27b-q4_K_M"
                />
              )}
              <p className="settings-hint">
                Recommended: <code>qwen2.5-coder:32b</code> (best) or <code>qwen3:27b-q4_K_M</code>.
                Must support JSON-grammar output for structured mutations.
              </p>
            </FormField>
          ) : (
            <FormField id="claude-model" label="Claude model">
              <select
                id="claude-model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              >
                <option value="">— default ({ANTHROPIC_MODELS[0]}) —</option>
                {ANTHROPIC_MODELS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </FormField>
          )}
        </section>

        <div className="settings-footer">
          <button
            className="btn btn-primary"
            onClick={save}
            disabled={update.isPending}
          >
            {update.isPending ? 'Saving…' : saved ? '✓ Saved' : 'Save settings'}
          </button>
          <p className="settings-note muted">
            Changes take effect immediately. To set API keys, use environment variables
            (<code>ANTHROPIC_API_KEY</code>, <code>WEAVE_OLLAMA_URL</code>).
          </p>
        </div>
      </div>
    </div>
  );
}
