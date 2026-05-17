import { SignIn } from '@clerk/nextjs';

export default function Page() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-gray-100 flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <SignIn
          path="/sign-in"
          routing="path"
          signUpUrl="/sign-up"
          fallbackRedirectUrl="/"
        />
      </div>
    </main>
  );
}
