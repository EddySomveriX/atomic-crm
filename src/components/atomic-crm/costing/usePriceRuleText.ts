import { useLocaleState, useTranslate } from "ra-core";

import { formatMoney } from "../money/money";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { PriceRule } from "./pricing";

/** "маржа 30%", "націнка 50%" or "прибуток 200 ₴" for a price rule. */
export const usePriceRuleText = () => {
  const translate = useTranslate();
  const [locale = "uk"] = useLocaleState();
  const { currency } = useConfigurationContext();
  return (rule: PriceRule) =>
    translate(`crm.costing.rule_text.${rule.method}`, {
      value:
        rule.method === "profit"
          ? formatMoney(rule.value, currency, locale)
          : `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(rule.value)}%`,
    });
};
