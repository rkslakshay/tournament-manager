import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="text-3xl font-bold">Not found</h1>
      <p className="mt-3 text-slate-600 dark:text-slate-300">
        This tournament does not exist, or the link is mistyped.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-md bg-accent-600 px-4 py-2 font-medium text-white hover:bg-accent-700"
      >
        Go to the home page
      </Link>
    </div>
  );
}
