# Standard Pricing Stub (node-web)

## Plans
- free: $0/month
- pro: $29/month
- team: $99/month

## Integration Contract
1. Resolve current customer plan from auth/billing context.
2. Check feature gates before executing premium functionality.
3. Emit usage events (`billing.feature_access`) for metering.
4. Keep this file as source-of-truth until fully integrated billing provider exists.
