import { Suspense, type ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Notification } from "@/components/admin/notification";
import { Error } from "@/components/admin/error";
import { Skeleton } from "@/components/ui/skeleton";

import { useApplyAppearance } from "../appearance/useAppearance";
import { DataImportProvider } from "../dataImport/DataImportProvider";
import { RequireBusiness } from "../business/RequireBusiness";
import { SubscriptionBanner } from "../subscription/SubscriptionBanner";
import { useConfigurationLoader } from "../root/useConfigurationLoader";
import { Sidebar } from "./Sidebar";

export const Layout = ({ children }: { children: ReactNode }) => {
  useConfigurationLoader();
  useApplyAppearance();
  return (
    <DataImportProvider>
      <div className="flex min-h-dvh">
        <Sidebar />
        <main className="min-w-0 flex-1" id="main-content">
          <div className="mx-auto max-w-screen-xl p-4 md:px-6">
            <ErrorBoundary FallbackComponent={Error}>
              <Suspense
                fallback={<Skeleton className="h-12 w-12 rounded-full" />}
              >
                <RequireBusiness>
                  <SubscriptionBanner />
                  {children}
                </RequireBusiness>
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>
      </div>
      <Notification />
    </DataImportProvider>
  );
};
