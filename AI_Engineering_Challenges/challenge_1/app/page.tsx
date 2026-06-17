import type { Metadata } from "next";
import Navbar from "./components/Navbar";
import PlanComparison from "./components/PlanComparison";
import SiteFooter from "./components/SiteFooter";

export const metadata: Metadata = {
  title: "Insurance Plans — Papaya",
  description: "Compare Bronze, Silver, and Gold insurance plans side by side",
};

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-white">
        <PlanComparison />
      </main>
      <SiteFooter />
    </>
  );
}
