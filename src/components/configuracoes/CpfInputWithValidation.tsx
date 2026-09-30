'use client';

import React, { useState } from 'react';
import { isValidCPF, formatCPF } from '@/lib/cpf-validator';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

interface CpfInputWithValidationProps {
  name?: string;
  required?: boolean;
  defaultValue?: string;
  className?: string;
}

export function CpfInputWithValidation({
  name = 'cpf',
  required = true,
  defaultValue = '',
  className = '',
}: CpfInputWithValidationProps) {
  const [value, setValue] = useState(defaultValue ? formatCPF(defaultValue) : '');

  const cleanDigits = value.replace(/\D/g, '');
  const isComplete = cleanDigits.length === 11;
  const valid = isComplete ? isValidCPF(cleanDigits) : false;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const formatted = formatCPF(raw);
    setValue(formatted);

    // Set custom validity to prevent form submission if complete but invalid
    const digits = formatted.replace(/\D/g, '');
    if (digits.length === 11 && !isValidCPF(digits)) {
      e.target.setCustomValidity('CPF inválido. Verifique os dígitos informados.');
    } else {
      e.target.setCustomValidity('');
    }
  };

  return (
    <div className="space-y-1">
      <div className="relative">
        <input
          type="text"
          name={name}
          id={name}
          required={required}
          value={value}
          onChange={handleChange}
          maxLength={14}
          placeholder="000.000.000-00"
          className={`w-full h-9 rounded-md px-3 text-xs border transition-colors font-mono ${
            isComplete
              ? valid
                ? 'border-emerald-500/60 bg-emerald-500/[0.04] text-emerald-300 focus:border-emerald-400'
                : 'border-rose-500/60 bg-rose-500/[0.04] text-rose-300 focus:border-rose-400'
              : 'border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 dark:border-white/12 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/30 focus:border-amber-400/50'
          } ${className}`}
        />
        {isComplete && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
            {valid ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            )}
          </div>
        )}
      </div>
      {isComplete && (
        <p className={`text-[10px] font-medium flex items-center gap-1 ${valid ? 'text-emerald-400' : 'text-rose-400'}`}>
          {valid ? '✓ CPF Válido (Receita Federal)' : '✗ CPF Inválido (dígitos verificadores incorretos)'}
        </p>
      )}
    </div>
  );
}
