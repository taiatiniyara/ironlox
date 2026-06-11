import { GuestGuard } from "@/components/auth-guard";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <GuestGuard>
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </GuestGuard>
  );
}
