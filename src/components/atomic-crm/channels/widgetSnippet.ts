/**
 * The code a business pastes into its website to show the widget: the script
 * served with the CRM, the public key of the widget and the address of the
 * widget API (the widget_api edge function).
 */
export const widgetSnippet = (
  publicKey: string,
  crmOrigin: string = window.location.origin,
  supabaseUrl: string = import.meta.env.VITE_SUPABASE_URL,
): string =>
  `<script src="${crmOrigin}/widget/widget.js" data-key="${publicKey}" data-api="${supabaseUrl}/functions/v1/widget_api" async></script>`;
