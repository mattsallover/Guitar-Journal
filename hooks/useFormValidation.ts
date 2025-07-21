import { useState } from 'react';

interface ValidationRule<T> {
  field: keyof T;
  required?: boolean;
  message?: string;
  validator?: (value: any) => boolean;
}

interface UseFormValidationProps<T> {
  initialValues: T;
  rules?: ValidationRule<T>[];
}

export function useFormValidation<T extends Record<string, any>>({
  initialValues,
  rules = []
}: UseFormValidationProps<T>) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});

  const setValue = (field: keyof T, value: any) => {
    setValues(prev => ({ ...prev, [field]: value }));
    if (touched[field]) {
      validateField(field, value);
    }
  };

  const setFieldTouched = (field: keyof T) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    validateField(field, values[field]);
  };

  const validateField = (field: keyof T, value: any) => {
    const rule = rules.find(r => r.field === field);
    if (!rule) return;

    let error = '';

    if (rule.required && (!value || (typeof value === 'string' && !value.trim()))) {
      error = rule.message || `${String(field)} is required`;
    } else if (rule.validator && !rule.validator(value)) {
      error = rule.message || `${String(field)} is invalid`;
    }

    setErrors(prev => ({ ...prev, [field]: error || undefined }));
    return !error;
  };

  const validate = (): boolean => {
    let isValid = true;
    const newErrors: Partial<Record<keyof T, string>> = {};

    rules.forEach(rule => {
      const value = values[rule.field];
      let error = '';

      if (rule.required && (!value || (typeof value === 'string' && !value.trim()))) {
        error = rule.message || `${String(rule.field)} is required`;
        isValid = false;
      } else if (rule.validator && !rule.validator(value)) {
        error = rule.message || `${String(rule.field)} is invalid`;
        isValid = false;
      }

      if (error) {
        newErrors[rule.field] = error;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const reset = () => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  };

  return {
    values,
    errors,
    touched,
    setValue,
    setFieldTouched,
    validate,
    reset,
    isValid: Object.keys(errors).length === 0
  };
}