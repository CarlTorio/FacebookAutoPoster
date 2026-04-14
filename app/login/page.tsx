import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-muted/30">
      <div className="w-full max-w-sm bg-white border border-border rounded-lg p-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight">
            Sign in to AgentFB
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Admin panel access only.
          </p>
        </div>
        <LoginForm redirectTo={redirectTo} />
      </div>
    </div>
  );
}
