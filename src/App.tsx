import {
  ArrowRight,
  BarChart3,
  Bot,
  BrainCircuit,
  CheckCircle2,
  Cloud,
  Database,
  FileText,
  Github,
  GitBranch,
  Layers3,
  Mic2,
  Radio,
  Server,
  Users,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring, useTransform, type Variants } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ScrollToTop } from "./components/ScrollToTop";
import "./App.css";

const logoUrl = `${import.meta.env.BASE_URL}intertalk_logo.png`;
const designUrl = `${import.meta.env.BASE_URL}intertalk_desing.png`;

const fadeUp: Variants = {
  hidden: { opacity: 0.76, y: 34, scale: 0.985 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

const slideInLeft: Variants = {
  hidden: { opacity: 0.78, x: -36, y: 12 },
  visible: {
    opacity: 1,
    x: 0,
    y: 0,
    transition: { duration: 0.68, ease: [0.22, 1, 0.36, 1] },
  },
};

const slideInRight: Variants = {
  hidden: { opacity: 0.78, x: 36, y: 12 },
  visible: {
    opacity: 1,
    x: 0,
    y: 0,
    transition: { duration: 0.68, ease: [0.22, 1, 0.36, 1] },
  },
};

const cardPop: Variants = {
  hidden: { opacity: 0.82, y: 30, rotateX: 5, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    scale: 1,
    transition: { duration: 0.62, ease: [0.16, 1, 0.3, 1] },
  },
};

const stagger: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.11,
      delayChildren: 0.04,
    },
  },
};

type Feature = {
  title: string;
  description: string;
  icon: LucideIcon;
};

type TechGroup = {
  title: string;
  items: string[];
  icon: LucideIcon;
};

type JourneyStep = {
  step: string;
  title: string;
  description: string;
  images: { src: string; alt: string }[];
  layout: "single" | "settings" | "wide" | "feedback";
};

const navItems = [
  { label: "문제 정의", href: "#problem" },
  { label: "주요 기능", href: "#features" },
  { label: "구조", href: "#architecture" },
  { label: "기술", href: "#tech-stack" },
  { label: "팀", href: "#team" },
];

const features: Feature[] = [
  {
    title: "내 이력에서 출발하는 질문",
    description:
      "사용자가 올린 이력서와 자기소개서에서 프로젝트, 기술 스택, 경험 키워드를 읽고 면접 질문의 기준으로 사용합니다.",
    icon: FileText,
  },
  {
    title: "실제 면접 후기 참고",
    description:
      "기술 면접 후기 데이터를 검색해 질문을 보강합니다. 정해진 문제집이 아니라 실제 면접에서 자주 나오는 흐름에 가깝게 구성했습니다.",
    icon: BrainCircuit,
  },
  {
    title: "말로 진행하는 모의 면접",
    description:
      "텍스트로 답을 적는 방식이 아니라, 마이크로 답변하며 면접 흐름을 이어갑니다. 답변 시간과 현재 질문을 한 화면에서 확인할 수 있습니다.",
    icon: Mic2,
  },
  {
    title: "답변에 이어지는 추가 질문",
    description:
      "답변이 충분하지 않거나 더 확인할 부분이 있으면 추가 질문으로 이어집니다. 외운 답변보다 설명의 근거를 연습하는 데 초점을 뒀습니다.",
    icon: GitBranch,
  },
  {
    title: "면접 후 피드백",
    description:
      "면접이 끝나면 질문별 답변을 다시 보고, 부족했던 부분과 참고할 만한 답변 방향을 확인할 수 있습니다.",
    icon: BarChart3,
  },
  {
    title: "함께 들어가는 그룹 면접",
    description:
      "혼자뿐 아니라 여러 명이 같은 면접 세션에 들어갈 수 있도록 대기실, Ready 상태, 참여자별 피드백 흐름을 준비했습니다.",
    icon: Users,
  },
];

const journeySteps: JourneyStep[] = [
  {
    step: "01",
    title: "서비스 시작",
    description: "최신 면접 데이터와 개인 이력을 바탕으로 연습을 시작하는 메인 화면",
    images: [
      { src: new URL("../ivterview_images/1_main.png", import.meta.url).href, alt: "Intertalk 메인 화면" },
    ],
    layout: "single",
  },
  {
    step: "02",
    title: "면접 조건 설정",
    description: "면접 방식, 직무, 이력서와 시간을 선택해 나에게 맞는 세션을 준비하는 과정",
    images: [
      { src: new URL("../ivterview_images/2_select1.png", import.meta.url).href, alt: "면접 유형 선택 화면" },
      { src: new URL("../ivterview_images/2_select2.png", import.meta.url).href, alt: "직무 선택 화면" },
      { src: new URL("../ivterview_images/2_select3.png", import.meta.url).href, alt: "이력서 선택 화면" },
      { src: new URL("../ivterview_images/2_select4.png", import.meta.url).href, alt: "면접 시간 선택 화면" },
    ],
    layout: "settings",
  },
  {
    step: "03",
    title: "실시간 AI 면접",
    description: "질문과 남은 시간을 확인하며 음성으로 답변하고, 진행 기록을 함께 확인하는 면접 화면",
    images: [
      { src: new URL("../ivterview_images/3_interview.png", import.meta.url).href, alt: "실시간 AI 면접 화면" },
    ],
    layout: "wide",
  },
  {
    step: "04",
    title: "결과와 피드백",
    description: "종합 평가와 역량 분석을 통해 강점, 약점과 다음 연습 방향을 확인하는 리포트",
    images: [
      { src: new URL("../ivterview_images/4_feedback1.png", import.meta.url).href, alt: "면접 피드백 종합 평가 화면" },
      { src: new URL("../ivterview_images/4_feedback2.png", import.meta.url).href, alt: "면접 피드백 상세 분석 화면" },
    ],
    layout: "feedback",
  },
];

const journeyMediaClasses: Record<JourneyStep["layout"], string> = {
  single: "journey-media journey-media-single",
  settings: "journey-media journey-media-settings",
  wide: "journey-media journey-media-wide",
  feedback: "journey-media journey-media-feedback",
};

const techGroups: TechGroup[] = [
  {
    title: "Frontend",
    items: ["React", "Vite", "Tailwind CSS", "Framer Motion", "LiveKit Client", "Recharts"],
    icon: Layers3,
  },
  {
    title: "Backend",
    items: ["Java", "Spring Boot", "Spring Security", "JWT", "JPA", "PostgreSQL"],
    icon: Server,
  },
  {
    title: "AI / RAG",
    items: ["Python", "LiveKit Agent", "AWS Bedrock Claude", "Bedrock Knowledge Base", "boto3"],
    icon: BrainCircuit,
  },
  {
    title: "Realtime & Infra",
    items: ["LiveKit", "WebRTC", "STT/TTS", "AWS EC2", "GitHub Actions"],
    icon: Cloud,
  },
];

const repositories = [
  {
    name: "Frontend",
    description: "React 기반 사용자 화면과 실시간 면접 UI",
    href: "https://github.com/capstone-ai-mock-interview/frontend",
  },
  {
    name: "Backend",
    description: "Spring Boot 인증, 세션, 기록, 평가 API",
    href: "https://github.com/capstone-ai-mock-interview/backend.git",
  },
  {
    name: "RAG",
    description: "LiveKit Agent와 Bedrock 기반 질문 생성 파이프라인",
    href: "https://github.com/capstone-ai-mock-interview/RAG.git",
  },
];

const teamMembers = [
  { name: "김준범", github: "https://github.com/Silbet", avatar: "https://github.com/Silbet.png" },
  { name: "최현택", github: "https://github.com/cuixianze", avatar: "https://github.com/cuixianze.png" },
  { name: "정은미", github: "https://github.com/eunmiii", avatar: "https://github.com/eunmiii.png" },
  { name: "함태원", github: "https://github.com/HTW01", avatar: "https://github.com/HTW01.png" },
];

function SectionHeader({
  title,
  description,
  align = "center",
}: {
  title: string;
  description: string;
  align?: "left" | "center";
}) {
  return (
    <motion.div
      className={align === "left" ? "mx-0 max-w-3xl" : "mx-auto max-w-3xl text-center"}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={fadeUp}
    >
      <h2 className="text-3xl font-bold leading-tight tracking-[-0.01em] text-slate-950 md:text-5xl">
        {title}
      </h2>
      <p className="mt-5 text-base leading-8 text-slate-600 md:text-lg">{description}</p>
    </motion.div>
  );
}

function ScrollAtmosphere() {
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const ribbonY = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [-80, 120]);
  const ribbonX = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [-24, 36]);
  const noteY = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [70, -110]);

  return (
    <div className="scroll-atmosphere" aria-hidden="true">
      <motion.div className="ambient-sheet ambient-sheet-a" style={{ x: ribbonX, y: ribbonY }} />
      <motion.div className="ambient-sheet ambient-sheet-b" style={{ y: noteY }} />
      <motion.div className="signal-ribbon signal-ribbon-a" style={{ x: ribbonX, y: ribbonY }} />
      <motion.div className="signal-ribbon signal-ribbon-b" style={{ y: noteY }} />
      <motion.div className="signal-notes" style={{ y: noteY }}>
        <span />
        <span />
        <span />
        <span />
      </motion.div>
    </div>
  );
}

function Navbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
      <nav className="container flex h-16 items-center justify-between gap-4">
        <a className="flex items-center gap-3" href="#top" aria-label="Intertalk home">
          <img className="h-9 w-auto object-contain" src={logoUrl} alt="Intertalk logo" />
        </a>
        <div className="hidden items-center gap-7 lg:flex">
          {navItems.map((item) => (
            <a
              key={item.href}
              className="text-sm font-semibold text-slate-600 transition-colors hover:text-blue-700"
              href={item.href}
            >
              {item.label}
            </a>
          ))}
        </div>
        <a
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-bold text-white shadow-sm shadow-blue-600/20 transition hover:-translate-y-0.5 hover:bg-blue-700 sm:px-4"
          href="#repositories"
        >
          <Github className="h-4 w-4" />
          <span className="hidden sm:inline">GitHub</span>
        </a>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section id="top" className="relative z-20 overflow-hidden border-b border-slate-200 bg-grid pt-28">
      <div className="container grid items-center gap-12 pb-16 pt-10 lg:grid-cols-[1.02fr_0.98fr] lg:pb-20">
        <motion.div
          className="min-w-0 max-w-[calc(100vw-3rem)] lg:max-w-none"
          initial="hidden"
          animate="visible"
          variants={stagger}
        >
          <motion.div
            className="mb-6 flex items-center gap-3 text-sm font-bold text-slate-700"
            variants={fadeUp}
          >
            <span className="h-px w-10 bg-blue-400" />
            AWS 캡스톤디자인 60팀
          </motion.div>
          <motion.h1
            className="hero-title max-w-3xl text-6xl font-black leading-[0.96] tracking-[-0.03em] md:text-8xl"
            variants={fadeUp}
          >
            INTERTALK
          </motion.h1>
          <motion.p
            className="mt-6 max-w-2xl break-words text-xl font-bold leading-snug text-slate-900 sm:text-2xl md:text-3xl"
            variants={fadeUp}
          >
            <span className="block sm:inline">이력서에서 질문을 만들고,</span>{" "}
            <span className="block sm:inline">말로 연습하는 개발자</span>{" "}
            <span className="block sm:inline">모의 면접 서비스</span>
          </motion.p>
          <motion.p className="mt-6 max-w-2xl break-words text-lg leading-8 text-slate-600" variants={fadeUp}>
            <span className="block sm:inline">
              Intertalk은 지원자의 이력서와 자기소개서를 바탕으로 질문을 구성하고,
            </span>{" "}
            <span className="block sm:inline">
              실제 기술 면접 후기 데이터를 참고해 음성 면접과 피드백까지 이어지도록 만들었습니다.
            </span>
          </motion.p>
          <motion.div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap" variants={fadeUp}>
            <a
              className="inline-flex h-12 w-[calc(100vw-3rem)] max-w-sm items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-base font-bold text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:bg-blue-700 sm:w-auto sm:justify-start"
              href="#features"
            >
              서비스 둘러보기
              <ArrowRight className="h-5 w-5" />
            </a>
            <a
              className="inline-flex h-12 w-[calc(100vw-3rem)] max-w-sm items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 text-base font-bold text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:text-blue-700 sm:w-auto sm:justify-start"
              href="#repositories"
            >
              <Github className="h-5 w-5" />
              GitHub 보기
            </a>
          </motion.div>
          <motion.div
            className="mt-10 grid w-[calc(100vw-3rem)] max-w-sm grid-cols-1 gap-3 sm:w-auto sm:max-w-xl sm:grid-cols-3"
            variants={fadeUp}
          >
            {[
              ["이력서·자소서", "개인 자료 기반 질문"],
              ["음성 면접", "말로 답변하는 연습"],
              ["1:1 · 그룹", "혼자 또는 함께 진행"],
            ].map(([value, label]) => (
              <div key={label} className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
                <strong className="block whitespace-nowrap text-xl font-black text-blue-700">{value}</strong>
                <span className="mt-1 block text-sm font-medium text-slate-500">{label}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>

        <motion.div
          className="hero-design-float"
          initial={{ opacity: 0, y: 28, scale: 0.94, rotate: -2 }}
          animate={{ opacity: 1, y: [0, -16, 0], scale: 1, rotate: [-1.2, 1.2, -1.2] }}
          transition={{
            opacity: { duration: 0.7, ease: "easeOut" },
            scale: { duration: 0.7, ease: "easeOut" },
            y: { duration: 6.5, repeat: Infinity, ease: "easeInOut" },
            rotate: { duration: 8, repeat: Infinity, ease: "easeInOut" },
          }}
        >
          <img src={designUrl} alt="" />
        </motion.div>
      </div>
    </section>
  );
}

function ProblemSolution() {
  return (
    <section id="problem" className="relative overflow-hidden py-24">
      <div className="container grid gap-8 lg:grid-cols-2">
        <motion.article
          className="glass-panel rounded-lg p-8"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={slideInLeft}
          whileHover={{ y: -6, transition: { duration: 0.22 } }}
        >
          <p className="mb-4 text-sm font-black uppercase tracking-[0.18em] text-yellow-600">Problem</p>
          <h2 className="text-3xl font-black leading-tight text-slate-950 md:text-4xl">
            놓치기 쉬운 내 프로젝트 질문
          </h2>
          <p className="mt-6 leading-8 text-slate-600">
            개발자 면접에서는 개념을 아는지보다, 내가 만든 프로젝트에서 어떤 선택을 했고
            왜 그렇게 판단했는지를 묻는 경우가 많습니다.
          </p>
          <p className="mt-4 leading-8 text-slate-600">
            하지만 혼자 준비하면 내 이력에서 어떤 질문이 나올지 예상하기 어렵고, 말로
            답변하는 연습도 충분히 하기 어렵습니다.
          </p>
        </motion.article>

        <motion.article
          className="glass-panel rounded-lg p-8"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={slideInRight}
          whileHover={{ y: -6, transition: { duration: 0.22 } }}
        >
          <p className="mb-4 text-sm font-black uppercase tracking-[0.18em] text-blue-700">Solution</p>
          <h2 className="text-3xl font-black leading-tight text-slate-950 md:text-4xl">
            이력서와 자기소개서에서 시작되는 맞춤 질문
          </h2>
          <p className="mt-6 leading-8 text-slate-600">
            사용자가 등록한 자료에서 프로젝트 경험과 기술 스택을 읽고, 실제 면접 후기
            데이터를 참고해 질문을 구성합니다.
          </p>
          <p className="mt-4 leading-8 text-slate-600">
            이후 사용자는 음성으로 답변하고, 면접이 끝난 뒤에는 질문별 피드백을 확인하며
            다시 연습할 수 있습니다.
          </p>
        </motion.article>
      </div>
    </section>
  );
}

function Features() {
  const showcaseRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [previewTravel, setPreviewTravel] = useState(0);
  const [animatePreview, setAnimatePreview] = useState(false);
  const { scrollYProgress } = useScroll({
    target: showcaseRef,
    offset: ["start 35%", "end 70%"],
  });
  const rawPreviewY = useTransform(
    scrollYProgress,
    [0, 0.14, 0.88, 1],
    [0, 0, previewTravel, previewTravel],
  );
  const previewY = useSpring(rawPreviewY, {
    stiffness: 95,
    damping: 28,
    mass: 0.5,
  });

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1025px)");
    const update = () => {
      setAnimatePreview(media.matches);
      if (!previewRef.current || !listRef.current) {
        return;
      }

      setPreviewTravel(Math.max(0, listRef.current.offsetHeight - previewRef.current.offsetHeight));
    };
    const observer = new ResizeObserver(update);

    if (previewRef.current) {
      observer.observe(previewRef.current);
    }
    if (listRef.current) {
      observer.observe(listRef.current);
    }

    media.addEventListener("change", update);
    update();

    return () => {
      observer.disconnect();
      media.removeEventListener("change", update);
    };
  }, []);

  return (
    <section id="features" className="relative overflow-clip py-24">
      <div className="container">
        <SectionHeader
          title="준비는 짧게, 면접은 실제처럼"
          description="이력서 등록, 질문 생성, 음성 답변, 피드백까지 한 번에 이어지는 기술 면접 연습 흐름"
        />
        <motion.div
          ref={showcaseRef}
          className="feature-showcase mt-14"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={stagger}
        >
          <div className="relative">
            <motion.div
              ref={previewRef}
              style={{ y: animatePreview && !reduceMotion ? previewY : 0 }}
            >
              <FlowPreview />
            </motion.div>
          </div>
          <div ref={listRef} className="feature-list">
          {features.map((feature, index) => (
            <motion.article
              key={feature.title}
              className="feature-line"
              variants={fadeUp}
            >
              <span className="feature-index">{String(index + 1).padStart(2, "0")}</span>
              <div className="feature-line-icon">
                <feature.icon className="h-5 w-5" />
              </div>
              <div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </div>
            </motion.article>
          ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function FlowPreview() {
  return (
    <div className="glass-panel rounded-lg p-4 shadow-xl shadow-blue-900/10">
      <div className="rounded-lg border border-blue-100 bg-blue-50/80 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">면접 준비</p>
            <h3 className="mt-2 text-2xl font-black text-slate-950">백엔드 직무 면접</h3>
          </div>
          <span className="rounded-lg bg-white px-3 py-1 text-xs font-black text-blue-700 shadow-sm">
            GROUP 2
          </span>
        </div>
        <div className="mt-6 space-y-3">
          {[
            ["이력서", "선택 완료", "bg-blue-500"],
            ["마이크", "확인 완료", "bg-yellow-400"],
            ["준비 상태", "2 / 2명", "bg-emerald-500"],
          ].map(([label, value, color]) => (
            <div key={label} className="rounded-lg bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-sm font-bold text-slate-700">
                <span>{label}</span>
                <span>{value}</span>
              </div>
              <div className="mt-3 h-2 rounded-lg bg-slate-100">
                <div className={`h-2 rounded-lg ${color}`} style={{ width: "86%" }} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-lg bg-slate-950 p-4 text-white">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-200">면접 질문</p>
          <p className="mt-2 font-semibold leading-7">
            프로젝트에서 Redis를 사용했을 때, 데이터 정합성은 어떻게 보장했나요?
          </p>
          <div className="mt-4 flex h-8 items-end gap-1.5">
            {[28, 60, 42, 76, 52, 88, 36, 68, 48, 72].map((height, index) => (
              <motion.span
                key={index}
                className="w-2 rounded-full bg-blue-300"
                animate={{ height: [`${height * 0.45}%`, `${height}%`, `${height * 0.62}%`] }}
                transition={{
                  duration: 1.4,
                  repeat: Infinity,
                  delay: index * 0.07,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function UserJourney() {
  const [activeStep, setActiveStep] = useState(0);
  const currentStep = journeySteps[activeStep];

  return (
    <section className="relative overflow-clip py-24">
      <div className="container">
        <SectionHeader
          title="실제 화면으로 보는 면접 흐름"
          description="면접 시작부터 조건 설정, 실시간 답변, 결과 피드백까지 이어지는 Intertalk의 사용 과정"
        />
        <motion.div
          className="journey-steps mt-14"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={stagger}
        >
          {journeySteps.map((step, index) => (
            <motion.button
              key={step.step}
              type="button"
              className={`journey-step${activeStep === index ? " journey-step-active" : ""}`}
              aria-pressed={activeStep === index}
              onMouseEnter={() => setActiveStep(index)}
              onFocus={() => setActiveStep(index)}
              onClick={() => setActiveStep(index)}
              variants={fadeUp}
            >
              <span className="journey-step-number">{step.step}</span>
              <span className="journey-step-title">{step.title}</span>
            </motion.button>
          ))}
        </motion.div>
        <div className="journey-display mt-9">
          <AnimatePresence mode="wait">
            <motion.article
              key={currentStep.step}
              className="journey-detail"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
            >
              <div className="journey-detail-copy">
                <span className="journey-detail-number">{currentStep.step}</span>
                <h3>{currentStep.title}</h3>
                <p>{currentStep.description}</p>
              </div>
              <div className={journeyMediaClasses[currentStep.layout]}>
                {currentStep.images.map((image) => (
                  <img key={image.src} src={image.src} alt={image.alt} />
                ))}
              </div>
            </motion.article>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

function Architecture() {
  const nodes = [
    { label: "React Frontend", icon: Layers3 },
    { label: "Spring Boot", icon: Server },
    { label: "LiveKit Room", icon: Radio },
    { label: "Python Agent", icon: Bot },
    { label: "AWS Bedrock", icon: BrainCircuit },
    { label: "Knowledge Base", icon: Database },
  ];

  return (
    <section id="architecture" className="relative overflow-hidden py-24">
      <div className="container">
        <SectionHeader
          title="면접 흐름을 잇는 시스템 구조"
          description="사용자 화면, 세션 제어, 실시간 음성 연결, AI 질문 생성이 어떤 순서로 연결되는지 보여주는 구조도"
        />
        <motion.div
          className="glass-panel mt-14 rounded-lg p-5 md:p-8"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={stagger}
        >
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            {nodes.map((node, index) => (
              <motion.div key={node.label} className="relative" variants={cardPop}>
                <motion.div
                  className="rounded-lg border border-blue-100 bg-white/88 p-5 text-center shadow-sm shadow-blue-900/5"
                  whileHover={{ y: -5, transition: { duration: 0.2 } }}
                >
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                    <node.icon className="h-6 w-6" />
                  </div>
                  <p className="mt-4 text-sm font-black text-slate-950">{node.label}</p>
                </motion.div>
                {index < nodes.length - 1 && (
                  <motion.div
                    className="absolute -right-2 top-1/2 hidden h-px w-4 origin-left bg-blue-300 xl:block"
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.18 + index * 0.08 }}
                  />
                )}
              </motion.div>
            ))}
          </div>
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {[
              ["세션 제어", "인증, 면접 세션 생성, 참여자 관리, 결과 저장을 Spring Boot가 담당합니다."],
              ["음성 인터뷰", "LiveKit Room에서 사용자와 면접 Agent가 같은 실시간 채널에 들어갑니다."],
              ["질문 구성", "실제 면접 후기 데이터를 검색해 이력서와 직무에 맞는 질문을 만드는 데 활용합니다."],
            ].map(([title, description]) => (
              <motion.div
                key={title}
                className="rounded-lg border border-blue-100 bg-white/86 p-5 shadow-sm shadow-blue-900/5"
                variants={cardPop}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
              >
                <CheckCircle2 className="h-5 w-5 text-blue-700" />
                <h3 className="mt-3 font-black text-slate-950">{title}</h3>
                <p className="mt-2 leading-7 text-slate-600">{description}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function TechStack() {
  return (
    <section id="tech-stack" className="relative overflow-hidden py-24">
      <div className="container">
        <SectionHeader
          title="사용 기술"
          description="화면, 서버, 실시간 음성 연결, AI 질문 생성을 구성하는 주요 기술 스택"
        />
        <div className="mt-14 grid gap-5 lg:grid-cols-2">
          {techGroups.map((group) => (
            <motion.article
              key={group.title}
              className="glass-panel rounded-lg p-6"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={cardPop}
              whileHover={{ y: -6, transition: { duration: 0.2 } }}
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                  <group.icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-black text-slate-950">{group.title}</h3>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {group.items.map((item) => (
                  <motion.span
                    key={item}
                    className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-800"
                    whileHover={{ y: -2, backgroundColor: "#dbeafe" }}
                  >
                    {item}
                  </motion.span>
                ))}
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Team() {
  return (
    <section id="team" className="relative overflow-hidden py-24">
      <div className="container">
        <SectionHeader
          title="AWS 캡스톤디자인 60팀"
          description="Intertalk은 개발자 면접 준비를 더 실제에 가깝게 연습해보기 위해 만든 졸업 프로젝트입니다."
        />
        <motion.div
          className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-4"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={stagger}
        >
          {teamMembers.map((member) => (
            <motion.a
              key={member.github}
              className="glass-panel block rounded-lg p-6 text-center"
              href={member.github}
              target="_blank"
              rel="noreferrer"
              variants={cardPop}
              whileHover={{ y: -6, transition: { duration: 0.2 } }}
            >
              <img
                className="mx-auto h-14 w-14 rounded-lg object-cover shadow-sm"
                src={member.avatar}
                alt={`${member.name} GitHub profile`}
              />
              <p className="mt-4 text-lg font-black text-slate-950">{member.name}</p>
            </motion.a>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer id="repositories" className="bg-slate-950 py-16 text-white">
      <div className="container">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <div className="flex items-center gap-3">
              <img className="h-10 w-10 rounded-lg bg-white object-contain p-1" src={logoUrl} alt="" />
              <span className="text-2xl font-black">Intertalk</span>
            </div>
            <p className="mt-5 max-w-xl leading-8 text-slate-300">
              이력서와 자기소개서를 바탕으로 질문을 만들고, 음성으로 답변하며,
              면접 후 피드백을 확인할 수 있는 개발자 모의 면접 서비스입니다.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {repositories.map((repo) => (
              <a
                key={repo.name}
                className="rounded-lg border border-white/10 bg-white/5 p-4 transition hover:-translate-y-1 hover:border-blue-300/60 hover:bg-white/10"
                href={repo.href}
                target="_blank"
                rel="noreferrer"
              >
                <Github className="h-5 w-5 text-blue-300" />
                <p className="mt-3 font-black">{repo.name}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{repo.description}</p>
              </a>
            ))}
          </div>
        </div>
        <div className="mt-12 border-t border-white/10 pt-6 text-sm text-slate-400">
          2026 국민대학교 소프트웨어융합대학 캡스톤디자인 · AWS 캡스톤디자인 60팀
        </div>
      </div>
    </footer>
  );
}

function App() {
  return (
    <>
      <Navbar />
      <main className="page-shell">
        <ScrollAtmosphere />
        <div className="page-content">
          <Hero />
          <ProblemSolution />
          <Features />
          <UserJourney />
          <Architecture />
          <TechStack />
          <Team />
        </div>
      </main>
      <Footer />
      <ScrollToTop />
    </>
  );
}

export default App;
