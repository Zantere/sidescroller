import GameCanvas from "@/components/GameCanvas";

export default function Home() {
  return (
    <main className="shell">
      <section className="gameFrame" aria-label="2D side scrolling shooter">
        <GameCanvas />
      </section>
    </main>
  );
}
