import { GuestGuard } from "@/components/auth-guard";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <GuestGuard>
      <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-6">
        <div className="flex items-center gap-3">
          <img src="/logo-icon.svg" alt="Ironlox" className="size-8" />
          <h1 className="text-xl font-semibold tracking-tight">Ironlox</h1>
        </div>
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </GuestGuard>
  );
}
