export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      {/* Left branded panel — desktop */}
      <div className="hidden lg:flex lg:flex-col lg:items-center lg:justify-center bg-secondary px-8">
        <div className="flex flex-col items-center gap-6 mb-8">
          <img
            src="/skillhub-logo.jpeg"
            alt="Skill Hub"
            className="h-28 w-auto object-contain rounded-xl shadow-lg"
          />
          <img
            src="/ncfe-logo.jpg"
            alt="NCFE"
            className="h-16 w-auto object-contain rounded-lg"
          />
        </div>
        <p className="text-white/80 text-center text-lg max-w-xs leading-relaxed">
          Empowering learners with vocational excellence
        </p>
      </div>

      {/* Mobile branded header */}
      <div className="lg:hidden bg-secondary py-5 px-4 flex items-center justify-center gap-4">
        <img
          src="/skillhub-logo.jpeg"
          alt="Skill Hub"
          className="h-12 w-auto object-contain rounded-lg"
        />
        <img
          src="/ncfe-logo.jpg"
          alt="NCFE"
          className="h-8 w-auto object-contain rounded"
        />
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 items-center justify-center bg-background px-4 py-8 lg:py-0 lg:min-h-screen">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
