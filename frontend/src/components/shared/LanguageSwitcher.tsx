import { useTranslation } from 'react-i18next';
import type { CSSProperties } from 'react';

const LANGUAGES = ['es', 'en'] as const;

/** HU-084: toggles between the two supported languages. Deliberately shows the language codes
 * (not translated) - a language switcher's own label is conventionally in each language's own
 * name/code, never in the currently active language. */
export function LanguageSwitcher({ buttonStyle }: { buttonStyle?: CSSProperties }) {
  const { i18n, t } = useTranslation();
  const current = i18n.language.startsWith('en') ? 'en' : 'es';

  const next = () => {
    const nextLang = LANGUAGES[(LANGUAGES.indexOf(current) + 1) % LANGUAGES.length];
    void i18n.changeLanguage(nextLang);
  };

  return (
    <button
      type="button"
      onClick={next}
      aria-label={t('common.languageSwitcherAria')}
      style={{
        ...buttonStyle,
        fontSize: 12,
        fontFamily: '"JetBrains Mono", monospace',
        fontWeight: 600,
        letterSpacing: '0.04em',
        minWidth: 30,
        justifyContent: 'center',
      }}
    >
      {current.toUpperCase()}
    </button>
  );
}
