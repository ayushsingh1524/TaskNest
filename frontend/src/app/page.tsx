"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { ArrowRight, Code2, Kanban, LineChart, Notebook, Layers, Zap, Shield, Play, Pause } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { motion, type Variants } from "framer-motion";
import { LogoLink } from "@/components/ui/logo-link";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } }
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2
    }
  }
};

export default function Home() {
  const { isAuthenticated } = useAuthStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(e => {
        console.log("Autoplay prevented:", e);
        setIsPlaying(false);
      });
    }
  }, []);

  const togglePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20 overflow-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-xl border-b border-border/40">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <LogoLink className="group" textClassName="text-2xl font-bold tracking-tight" />
          
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="px-6 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all hover:scale-105"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden sm:block text-sm font-semibold hover:text-primary transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="px-6 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all hover:scale-105 shadow-sm"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="pt-32 pb-20">
        {/* Hero Section */}
        <motion.section 
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="max-w-7xl mx-auto px-6 pt-12 md:pt-20 pb-16 text-center flex flex-col items-center"
        >
          <motion.h1 
            variants={fadeUp}
            className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.05] mb-6"
          >
            Capable, fast, fluid.<br />
            Workspace for builders.
          </motion.h1>
          <motion.p 
            variants={fadeUp}
            className="text-lg md:text-2xl text-muted-foreground max-w-2xl mb-12 font-medium"
          >
            The all-in-one developer platform. Kanban boards, rich notes, and real-time analytics built for high-performance teams.
          </motion.p>
          
          <motion.div variants={fadeUp} onClick={togglePlay} className="w-full max-w-5xl aspect-video rounded-[2rem] bg-card border border-border/50 shadow-2xl overflow-hidden relative flex items-center justify-center group cursor-pointer">
             <video 
               ref={videoRef}
               src="https://vjs.zencdn.net/v/oceans.mp4" 
               autoPlay 
               loop 
               muted 
               playsInline 
               className="absolute inset-0 w-full h-full object-cover z-0 opacity-80 group-hover:opacity-100 transition-opacity duration-500"
             />
             <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-fauna-blue)]/20 to-[var(--color-fauna-green)]/20 opacity-30 z-0 pointer-events-none" />
             <div className="w-20 h-20 rounded-full bg-background/90 backdrop-blur-md flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform z-10 relative">
                {isPlaying ? <Pause className="w-8 h-8 text-foreground fill-foreground" /> : <Play className="w-8 h-8 text-foreground fill-foreground ml-1" />}
             </div>
          </motion.div>
        </motion.section>

        {/* Audience Section (3 columns with shapes) */}
        <motion.section 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="max-w-7xl mx-auto px-6 py-24"
          id="audience"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-16 md:gap-8 text-center">
            <motion.div variants={fadeUp} className="flex flex-col items-center">
              <div className="w-16 h-16 mb-6 flex items-center justify-center relative">
                <div className="absolute w-12 h-12 bg-[var(--color-fauna-pink)] rounded-lg -top-2 -left-2 opacity-80" />
                <div className="absolute w-12 h-12 bg-[var(--color-fauna-blue)] rounded-full top-2 left-2 opacity-80" />
              </div>
              <h3 className="text-2xl font-bold mb-4">For developers</h3>
              <p className="text-muted-foreground font-medium leading-relaxed">
                Build and track your own applications on an easy-to-use platform with full markdown support.
              </p>
            </motion.div>
            
            <motion.div variants={fadeUp} className="flex flex-col items-center">
              <div className="w-16 h-16 mb-6 flex items-center justify-center relative">
                <div className="absolute w-10 h-16 bg-primary rounded-full -left-1 opacity-80" />
                <div className="absolute w-12 h-10 bg-[var(--color-fauna-green)] rounded-lg top-6 left-6 opacity-80" />
              </div>
              <h3 className="text-2xl font-bold mb-4">For teams</h3>
              <p className="text-muted-foreground font-medium leading-relaxed">
                Collaborate seamlessly on next-generation projects that solve real business problems.
              </p>
            </motion.div>

            <motion.div variants={fadeUp} className="flex flex-col items-center">
              <div className="w-16 h-16 mb-6 flex items-center justify-center relative">
                <div className="absolute w-14 h-14 bg-[var(--color-fauna-yellow)] rounded-xl opacity-90" />
                <div className="absolute w-4 h-4 bg-primary rounded-full top-2 right-2" />
              </div>
              <h3 className="text-2xl font-bold mb-4">For managers</h3>
              <p className="text-muted-foreground font-medium leading-relaxed">
                Study velocity, workflows, and productivity analytics on a versatile reporting platform.
              </p>
            </motion.div>
          </div>
        </motion.section>

        {/* Large Bento Grid Features */}
        <motion.section 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="max-w-7xl mx-auto px-6 py-24"
          id="features"
        >
          <motion.div variants={fadeUp} className="text-center mb-16">
            <h2 className="text-5xl md:text-6xl font-bold tracking-tight">A modern platform<br />for software development</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.div variants={fadeUp} className="bg-card rounded-[2.5rem] p-10 md:p-14 flex flex-col items-center text-center border border-border shadow-sm hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 mb-8 rounded-full bg-foreground flex items-center justify-center text-background">
                <Kanban className="w-6 h-6" />
              </div>
              <h3 className="text-3xl font-bold mb-4">Real-time Kanban</h3>
              <p className="text-muted-foreground font-medium mb-12">
                Drag and drop tasks with optimistic UI updates and instant sync.
              </p>
              
              <div className="w-full h-48 bg-background rounded-2xl flex items-center justify-center relative overflow-hidden p-6 gap-4">
                 <div className="w-1/3 h-full bg-[var(--color-fauna-green)]/20 rounded-xl border border-[var(--color-fauna-green)]/30 p-3 flex flex-col gap-2">
                    <div className="w-8 h-8 rounded-full bg-[var(--color-fauna-green)] mb-2" />
                    <div className="w-full h-12 bg-card rounded-md shadow-sm" />
                    <div className="w-full h-16 bg-card rounded-md shadow-sm" />
                 </div>
                 <div className="w-1/3 h-full bg-[var(--color-fauna-yellow)]/20 rounded-xl border border-[var(--color-fauna-yellow)]/30 p-3 flex flex-col gap-2 mt-4">
                    <div className="w-8 h-8 rounded-full bg-[var(--color-fauna-yellow)] mb-2" />
                    <div className="w-full h-16 bg-card rounded-md shadow-sm" />
                 </div>
                 <div className="w-1/3 h-full bg-primary/10 rounded-xl border border-primary/20 p-3 flex flex-col gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary mb-2" />
                    <div className="w-full h-12 bg-card rounded-md shadow-sm" />
                 </div>
              </div>
            </motion.div>

            <motion.div variants={fadeUp} className="bg-card rounded-[2.5rem] p-10 md:p-14 flex flex-col items-center text-center border border-border shadow-sm hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 mb-8 rounded-full bg-foreground flex items-center justify-center text-background">
                <Notebook className="w-6 h-6" />
              </div>
              <h3 className="text-3xl font-bold mb-4">Rich Markdown</h3>
              <p className="text-muted-foreground font-medium mb-12">
                Notion-style rich text markdown editor with auto-save and shortcuts.
              </p>
              
              <div className="w-full h-48 bg-background rounded-2xl flex items-center justify-center relative overflow-hidden p-8 flex-col gap-4 items-start">
                 <div className="w-2/3 h-6 rounded-full bg-foreground/20" />
                 <div className="w-full h-4 rounded-full bg-muted-foreground/20" />
                 <div className="w-4/5 h-4 rounded-full bg-muted-foreground/20" />
                 <div className="w-full h-4 rounded-full bg-muted-foreground/20" />
                 <div className="flex gap-2 mt-2">
                   <div className="w-16 h-6 rounded-full bg-[var(--color-fauna-pink)]/40" />
                   <div className="w-20 h-6 rounded-full bg-[var(--color-fauna-blue)]/40" />
                 </div>
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* Abstract Overlapping CTA Section */}
        <motion.section 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="max-w-7xl mx-auto px-6 py-32 relative overflow-hidden"
        >
          {/* Abstract overlapping shapes background */}
          <div className="absolute inset-0 pointer-events-none opacity-20 dark:opacity-40 flex items-center justify-center -z-10">
            <div className="w-64 h-64 bg-[var(--color-fauna-blue)] rounded-full absolute -translate-x-40" />
            <div className="w-80 h-80 bg-[var(--color-fauna-yellow)] rounded-full mix-blend-multiply absolute" />
            <div className="w-72 h-72 bg-[var(--color-fauna-brown)] rounded-[3rem] absolute translate-x-40 rotate-12" />
          </div>

          <div className="text-center z-10 relative bg-background/40 backdrop-blur-2xl p-16 rounded-[3rem] border border-border max-w-4xl mx-auto shadow-2xl">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to build?</h2>
            <p className="text-xl text-muted-foreground mb-10 font-medium">Join thousands of developers managing chaos with TaskNest.</p>
            <Link
              href={isAuthenticated ? "/dashboard" : "/register"}
              className="inline-flex items-center gap-2 px-10 py-5 rounded-full bg-primary text-primary-foreground text-lg font-bold hover:bg-primary/90 transition-all hover:scale-105 shadow-xl shadow-primary/20"
            >
              {isAuthenticated ? "Open Workspace" : "Get Started Now"}
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </motion.section>
      </main>

      <footer className="border-t border-border bg-card py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center bg-transparent">
              <img src="/logo.png" alt="TaskNest Logo" className="w-full h-full object-cover scale-[1.35]" />
            </div>
            <span className="font-bold">TaskNest Inc.</span>
          </div>
          <p className="text-muted-foreground text-sm font-medium">
            Designed with ♥️ for developers. &copy; {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}
