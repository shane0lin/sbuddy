import Stripe from 'stripe';
import { db } from '../models/database';
import authService from './authService';

export class PaymentService {
  private stripe: Stripe;

  constructor() {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }

    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16'
    });
  }

  async createCustomer(userId: string, email: string): Promise<string> {
    try {
      const customer = await this.stripe.customers.create({
        email,
        metadata: {
          userId
        }
      });

      // Update user's tenant with Stripe customer ID
      const user = await authService.getUserById(userId);
      if (user) {
        await this.updateTenantStripeCustomer(user.tenant_id, customer.id);
      }

      return customer.id;
    } catch (error) {
      console.error('Error creating Stripe customer:', error);
      throw new Error('Failed to create customer');
    }
  }

  async createSubscription(
    userId: string,
    priceId: string,
    paymentMethodId?: string
  ): Promise<Stripe.Subscription> {
    try {
      const user = await authService.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      let customerId = await this.getTenantStripeCustomer(user.tenant_id);

      if (!customerId) {
        customerId = await this.createCustomer(userId, user.email);
      }

      const subscriptionParams: Stripe.SubscriptionCreateParams = {
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: {
          save_default_payment_method: 'on_subscription'
        },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          userId,
          tenantId: user.tenant_id
        }
      };

      if (paymentMethodId) {
        subscriptionParams.default_payment_method = paymentMethodId;
      }

      const subscription = await this.stripe.subscriptions.create(subscriptionParams);

      return subscription;
    } catch (error) {
      console.error('Error creating subscription:', error);
      throw new Error('Failed to create subscription');
    }
  }

  async cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      return await this.stripe.subscriptions.cancel(subscriptionId);
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw new Error('Failed to cancel subscription');
    }
  }

  async updateSubscription(
    subscriptionId: string,
    newPriceId: string
  ): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);

      return await this.stripe.subscriptions.update(subscriptionId, {
        items: [{
          id: subscription.items.data[0].id,
          price: newPriceId
        }]
      });
    } catch (error) {
      console.error('Error updating subscription:', error);
      throw new Error('Failed to update subscription');
    }
  }

  async handleWebhook(
    body: string | Buffer,
    signature: string
  ): Promise<void> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET not configured');
    }

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      throw new Error('Invalid webhook signature');
    }

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionChange(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionCancellation(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  }

  private async handleSubscriptionChange(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata.userId;
    if (!userId) return;

    // Map Stripe price IDs to subscription tiers
    const priceToTierMap: Record<string, 'free' | 'premium' | 'enterprise'> = {
      // Add your actual Stripe price IDs here
      'price_premium_monthly': 'premium',
      'price_premium_yearly': 'premium',
      'price_enterprise_monthly': 'enterprise',
      'price_enterprise_yearly': 'enterprise'
    };

    const priceId = subscription.items.data[0]?.price.id;
    const subscriptionTier = priceToTierMap[priceId] || 'free';

    await authService.updateUser(userId, {
      subscription_tier: subscriptionTier
    });
  }

  private async handleSubscriptionCancellation(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata.userId;
    if (!userId) return;

    await authService.updateUser(userId, {
      subscription_tier: 'free'
    });
  }

  private async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    // Log successful payment, send confirmation email, etc.
    console.log('Payment succeeded for invoice:', invoice.id);
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    // Handle failed payment - notify user, retry logic, etc.
    console.log('Payment failed for invoice:', invoice.id);
  }

  private async updateTenantStripeCustomer(tenantId: string, customerId: string): Promise<void> {
    const query = 'UPDATE tenants SET stripe_customer_id = $1 WHERE id = $2';
    await db.query(query, [customerId, tenantId]);
  }

  private async getTenantStripeCustomer(tenantId: string): Promise<string | null> {
    const query = 'SELECT stripe_customer_id FROM tenants WHERE id = $1';
    const result = await db.query(query, [tenantId]);
    return result.rows[0]?.stripe_customer_id || null;
  }

  async getSubscriptionStatus(userId: string): Promise<{
    hasActiveSubscription: boolean;
    subscriptionTier: string;
    subscriptionId?: string;
    currentPeriodEnd?: Date;
  }> {
    const user = await authService.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const customerId = await this.getTenantStripeCustomer(user.tenant_id);

    if (!customerId) {
      return {
        hasActiveSubscription: false,
        subscriptionTier: 'free'
      };
    }

    try {
      const subscriptions = await this.stripe.subscriptions.list({
        customer: customerId,
        status: 'active'
      });

      const activeSubscription = subscriptions.data[0];

      if (activeSubscription) {
        return {
          hasActiveSubscription: true,
          subscriptionTier: user.subscription_tier,
          subscriptionId: activeSubscription.id,
          currentPeriodEnd: new Date(activeSubscription.current_period_end * 1000)
        };
      }

      return {
        hasActiveSubscription: false,
        subscriptionTier: 'free'
      };
    } catch (error) {
      console.error('Error fetching subscription status:', error);
      return {
        hasActiveSubscription: false,
        subscriptionTier: 'free'
      };
    }
  }

  async createPaymentIntent(amount: number, currency: string = 'usd'): Promise<Stripe.PaymentIntent> {
    return await this.stripe.paymentIntents.create({
      amount: amount * 100, // Stripe uses cents
      currency
    });
  }
}

export default new PaymentService();