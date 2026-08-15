/** 종목 상세를 불러오는 동안 보여줄 뼈대 화면 */
export default function Loading() {
  return (
    <main className="container-page flex-1 animate-pulse px-6 py-10">
      <div className="h-8 w-40 rounded bg-zinc-100 dark:bg-zinc-900" />
      <div className="mt-2 h-4 w-56 rounded bg-zinc-100 dark:bg-zinc-900" />
      <div className="mt-6 h-10 w-48 rounded bg-zinc-100 dark:bg-zinc-900" />
      <div className="mt-10 h-[450px] rounded-xl bg-zinc-100 lg:h-[560px] dark:bg-zinc-900" />
    </main>
  );
}
