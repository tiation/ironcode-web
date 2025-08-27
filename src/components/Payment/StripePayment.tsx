import React, { useState } from 'react';
import {
  PaymentElement,
  useStripe,
  useElements,
  Elements,
} from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import mixpanel from 'mixpanel-browser';

// Initialize Stripe
const stripePromise = loadStripe(process.env.VITE_STRIPE_PUBLIC_KEY!);

const PaymentContainer = styled(motion.div)`
  max-width: 600px;
  margin: 2rem auto;
  padding: 2rem;
  background: var(--surface-elevated);
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);

  @media (max-width: 768px) {
    margin: 1rem;
    padding: 1rem;
  }
`;

const PaymentForm = styled.form`
  width: 100%;
`;

const PayButton = styled(motion.button)`
  background: var(--primary);
  color: white;
  padding: 1rem 2rem;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  width: 100%;
  margin-top: 2rem;
  transition: background 0.2s;

  &:hover {
    background: var(--primary-dark);
  }

  &:disabled {
    background: var(--disabled);
    cursor: not-allowed;
  }
`;

const ErrorMessage = styled.div`
  color: var(--error);
  margin-top: 1rem;
  padding: 1rem;
  background: var(--error-bg);
  border-radius: 8px;
  font-size: 0.875rem;
`;

const SuccessMessage = styled.div`
  color: var(--success);
  margin-top: 1rem;
  padding: 1rem;
  background: var(--success-bg);
  border-radius: 8px;
  font-size: 0.875rem;
`;

const LoadingOverlay = styled(motion.div)`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.2rem;
  backdrop-filter: blur(4px);
`;

interface PaymentProps {
  amount: number;
  currency: string;
  productId: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

const CheckoutForm: React.FC<PaymentProps> = ({
  amount,
  currency,
  productId,
  onSuccess,
  onError,
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [processing, setProcessing] = useState<boolean>(false);
  const { t } = useTranslation();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // Track payment attempt
      mixpanel.track('Payment Attempt', {
        amount,
        currency,
        productId,
      });

      const { error: submitError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment/complete`,
        },
      });

      if (submitError) {
        setError(submitError.message || 'An error occurred');
        onError?.(new Error(submitError.message || 'Payment failed'));
        mixpanel.track('Payment Error', {
          error: submitError.message,
          amount,
          currency,
          productId,
        });
      } else {
        setSuccess(true);
        onSuccess?.();
        mixpanel.track('Payment Success', {
          amount,
          currency,
          productId,
        });
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError('An unexpected error occurred');
      onError?.(err as Error);
      mixpanel.track('Payment Error', {
        error: err.message,
        amount,
        currency,
        productId,
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <PaymentContainer
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <PaymentForm onSubmit={handleSubmit}>
        <PaymentElement />
        
        <PayButton
          type="submit"
          disabled={!stripe || processing}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {processing
            ? t('payment.processing')
            : t('payment.pay', { amount: amount / 100, currency: currency.toUpperCase() })}
        </PayButton>

        {error && <ErrorMessage>{error}</ErrorMessage>}
        {success && <SuccessMessage>{t('payment.success')}</SuccessMessage>}

        {processing && (
          <LoadingOverlay
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {t('payment.processing')}
          </LoadingOverlay>
        )}
      </PaymentForm>
    </PaymentContainer>
  );
};

interface StripePaymentWrapperProps extends PaymentProps {
  clientSecret: string;
}

export const StripePayment: React.FC<StripePaymentWrapperProps> = ({
  clientSecret,
  ...props
}) => {
  const options = {
    clientSecret,
    appearance: {
      theme: 'night',
      variables: {
        colorPrimary: '#6366f1',
        colorBackground: '#1f2937',
        colorText: '#f3f4f6',
        colorDanger: '#ef4444',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        borderRadius: '8px',
      },
    },
  };

  return (
    <Elements stripe={stripePromise} options={options}>
      <CheckoutForm {...props} />
    </Elements>
  );
};

export default StripePayment;
