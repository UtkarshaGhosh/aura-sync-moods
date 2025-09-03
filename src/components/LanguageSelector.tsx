import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useI18n, languageLabels, LangCode } from '@/i18n/I18nProvider';

const LanguageSelector: React.FC<{ className?: string }> = ({ className }) => {
  const { lang, setLang } = useI18n();

  return (
    <div className={className}>
      <Select value={lang} onValueChange={(v) => setLang(v as LangCode)}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Language" />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(languageLabels) as LangCode[]).map((code) => (
            <SelectItem key={code} value={code}>
              {languageLabels[code]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default LanguageSelector;
