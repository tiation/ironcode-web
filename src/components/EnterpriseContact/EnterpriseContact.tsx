import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import mixpanel from 'mixpanel-browser';

const FormSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email address'),
  company: z.string().min(2, 'Company name is required'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
});

type FormData = z.infer<typeof FormSchema>;

const StyledForm = styled(motion.form)`
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem;
  background: var(--surface-elevated);
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);

  @media (max-width: 768px) {
    padding: 1rem;
    margin: 1rem;
  }
`;

const FormField = styled.div`
  margin-bottom: 1.5rem;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 0.5rem;
  color: var(--text-primary);
  font-weight: 500;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.75rem;
  border: 2px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text-primary);
  transition: border-color 0.2s;

  &:focus {
    border-color: var(--primary);
    outline: none;
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  padding: 0.75rem;
  border: 2px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text-primary);
  min-height: 150px;
  resize: vertical;

  &:focus {
    border-color: var(--primary);
    outline: none;
  }
`;

const SubmitButton = styled(motion.button)`
  background: var(--primary);
  color: white;
  padding: 1rem 2rem;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  width: 100%;
  transition: background 0.2s;

  &:hover {
    background: var(--primary-dark);
  }

  &:disabled {
    background: var(--disabled);
    cursor: not-allowed;
  }
`;

const ErrorMessage = styled.span`
  color: var(--error);
  font-size: 0.875rem;
  margin-top: 0.25rem;
  display: block;
`;

export const EnterpriseContact: React.FC = () => {
  const { t } = useTranslation();
  const supabase = useSupabaseClient();
  
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset
  } = useForm<FormData>({
    resolver: zodResolver(FormSchema)
  });

  const onSubmit = async (data: FormData) => {
    try {
      // Track form submission attempt
      mixpanel.track('Enterprise Contact Form Submit', {
        company: data.company
      });

      // Store in Supabase
      const { error } = await supabase
        .from('enterprise_contacts')
        .insert([
          {
            name: data.name,
            email: data.email,
            company: data.company,
            message: data.message,
            source: 'web'
          }
        ]);

      if (error) throw error;

      // Send notification email to Arnold
      await fetch('/api/notify-enterprise-contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: 'garrett@sxc.codes',
          subject: `New Enterprise Inquiry from ${data.company}`,
          ...data,
        }),
      });

      // Track successful submission
      mixpanel.track('Enterprise Contact Form Success', {
        company: data.company
      });

      reset();
      alert(t('contact.success'));
    } catch (err) {
      console.error(err);
      mixpanel.track('Enterprise Contact Form Error', {
        error: err.message
      });
      alert(t('contact.error'));
    }
  };

  return (
    <StyledForm
      onSubmit={handleSubmit(onSubmit)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <FormField>
        <Label htmlFor="name">{t('contact.name')}</Label>
        <Input
          id="name"
          type="text"
          {...register('name')}
          aria-invalid={errors.name ? 'true' : 'false'}
        />
        {errors.name && <ErrorMessage>{errors.name.message}</ErrorMessage>}
      </FormField>

      <FormField>
        <Label htmlFor="email">{t('contact.email')}</Label>
        <Input
          id="email"
          type="email"
          {...register('email')}
          aria-invalid={errors.email ? 'true' : 'false'}
        />
        {errors.email && <ErrorMessage>{errors.email.message}</ErrorMessage>}
      </FormField>

      <FormField>
        <Label htmlFor="company">{t('contact.company')}</Label>
        <Input
          id="company"
          type="text"
          {...register('company')}
          aria-invalid={errors.company ? 'true' : 'false'}
        />
        {errors.company && <ErrorMessage>{errors.company.message}</ErrorMessage>}
      </FormField>

      <FormField>
        <Label htmlFor="message">{t('contact.message')}</Label>
        <TextArea
          id="message"
          {...register('message')}
          aria-invalid={errors.message ? 'true' : 'false'}
        />
        {errors.message && <ErrorMessage>{errors.message.message}</ErrorMessage>}
      </FormField>

      <SubmitButton
        type="submit"
        disabled={isSubmitting}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {isSubmitting ? t('contact.submitting') : t('contact.submit')}
      </SubmitButton>
    </StyledForm>
  );
};

export default EnterpriseContact;
