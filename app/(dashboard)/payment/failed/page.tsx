export default function PaymentFailedPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold text-red-700">Payment not completed</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        No points were added and you were not charged for a completed transaction.
      </p>
      <a href="/dashboard" className="mt-6 inline-block rounded-md border px-5 py-2.5 text-sm font-medium">
        Back to dashboard
      </a>
    </main>
  );
}
