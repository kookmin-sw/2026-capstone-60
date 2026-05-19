import {
  ArrowRight,
  BarChart3,
  Bot,
  BrainCircuit,
  CheckCircle2,
  ClipboardList,
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
import { motion, useReducedMotion, useScroll, useTransform, type Variants } from "framer-motion";
import { useRef } from "react";
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

type FlowStep = {
  step: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

type TechGroup = {
  title: string;
  items: string[];
  icon: LucideIcon;
};

const navItems = [
  { label: "문제 정의", href: "#problem" },
  { label: "주요 기능", href: "#features" },
  { label: "사용 흐름", href: "#flow" },
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

const flowSteps: FlowStep[] = [
  {
    step: "01",
    title: "이력서 등록",
    description: "PDF 또는 텍스트로 이력서와 자기소개서를 등록합니다.",
    icon: FileText,
  },
  {
    step: "02",
    title: "면접 설정",
    description: "지원 직무, 면접 시간, 참여 인원을 선택합니다.",
    icon: ClipboardList,
  },
  {
    step: "03",
    title: "마이크 테스트",
    description: "음성 면접을 시작하기 전에 마이크 상태를 확인합니다.",
    icon: Radio,
  },
  {
    step: "04",
    title: "AI 면접 진행",
    description: "AI 면접관이 질문을 제시하고, 사용자는 제한 시간 안에 음성으로 답변합니다.",
    icon: Bot,
  },
  {
    step: "05",
    title: "꼬리질문 응답",
    description: "답변이 부족하거나 더 확인할 부분이 있으면 AI가 추가 질문을 이어갑니다.",
    icon: GitBranch,
  },
  {
    step: "06",
    title: "결과 리포트 확인",
    description: "면접 종료 후 종합 피드백, 질문별 분석, 모범 답안을 확인합니다.",
    icon: BarChart3,
  },
];

const screenshotPlaceholders = [
  {
    title: "Home",
    subtitle: "서비스 진입과 면접 시작",
    lines: ["Realtime AI Mock Interview", "AI 면접 시작", "이전 기록 보기"],
  },
  {
    title: "Resume",
    subtitle: "이력서 등록과 관리",
    lines: ["resume_backend.pdf", "Spring, Redis, AWS", "문서 선택 완료"],
  },
  {
    title: "Setup",
    subtitle: "직무와 면접 시간 설정",
    lines: ["BACKEND", "15분", "그룹 2명"],
  },
  {
    title: "Interview Room",
    subtitle: "실시간 음성 면접",
    lines: ["Q3. Redis 선택 이유는?", "남은 답변 시간 01:12", "마이크 ON"],
  },
  {
    title: "Result",
    subtitle: "질문별 피드백 리포트",
    lines: ["논리성 8.5", "모범 답안 비교", "개선 방향"],
  },
  {
    title: "Group Lobby",
    subtitle: "대기실과 Ready 상태",
    lines: ["Host ready", "Guest ready", "자동 시작 대기"],
  },
];

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
    items: ["LiveKit", "WebRTC", "STT/TTS", "AWS EC2", "pgvector", "GitHub Actions"],
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

const teamMembers = ["김준범", "정은미", "최현택", "함태원"];

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
              ["1:1·그룹", "혼자 또는 함께 진행"],
            ].map(([value, label]) => (
              <div key={label} className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
                <strong className="block text-2xl font-black text-blue-700">{value}</strong>
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
            혼자 준비하면 내 프로젝트 질문을 놓치기 쉽습니다.
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
            Intertalk은 이력서와 자기소개서에서 질문을 시작합니다.
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
  return (
    <section id="features" className="relative overflow-hidden py-24">
      <div className="container">
        <SectionHeader
          title="준비 과정은 줄이고, 연습은 실제처럼."
          description="이력서 등록부터 질문 생성, 음성 답변, 면접 후 피드백까지 기술 면접 연습에 필요한 흐름을 한 번에 이어지게 만들었습니다."
        />
        <motion.div
          className="feature-showcase mt-14"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={stagger}
        >
          <div className="feature-showcase-preview">
            <p>interview loop</p>
            <strong>자료 등록 → 질문 → 음성 답변 → 피드백</strong>
          </div>
          <div className="feature-list">
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

function InterviewFlow() {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start center", "end center"],
  });
  const progressHeight = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);
  const previewY = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [18, -18]);
  const previewRotate = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [-1.5, 1.5]);

  return (
    <section id="flow" className="relative overflow-hidden py-24">
      <div className="container">
        <SectionHeader
          title="이력서를 올리고, 면접을 시작하고, 다시 확인합니다."
          description="사용자는 자료를 등록하고 면접 조건을 고른 뒤, AI 면접관의 질문에 음성으로 답변합니다. 면접 후에는 질문별 피드백을 보며 부족한 부분을 다시 확인합니다."
        />
        <div ref={ref} className="mt-16 grid gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="relative">
            <div className="absolute left-[1.15rem] top-0 hidden h-full w-px bg-blue-200/80 md:block" />
            <motion.div
              className="absolute left-[1.15rem] top-0 hidden w-px bg-blue-500 md:block"
              style={{ height: progressHeight }}
            />
            <div className="space-y-2">
              {flowSteps.map((item) => (
                <motion.article
                  key={item.step}
                  className="flow-step-minimal"
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-80px" }}
                  variants={fadeUp}
                >
                  <div className="flow-step-number">{item.step}</div>
                  <div className="flow-step-copy">
                    <item.icon className="h-5 w-5 text-blue-700" />
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
          <motion.div
            className="self-start lg:sticky lg:top-24"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={fadeUp}
            style={{ y: previewY, rotate: previewRotate }}
          >
            <FlowPreview />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function ScreenshotPlaceholders() {
  return (
    <section className="relative overflow-hidden py-24">
      <div className="container">
        <SectionHeader
          title="서비스 화면은 이런 흐름으로 이어집니다."
          description="홈, 이력서 등록, 면접 설정, 실시간 면접, 결과 리포트, 그룹 대기실까지 주요 사용 장면을 순서대로 정리했습니다."
        />
        <motion.div
          className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-3"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={stagger}
        >
          {screenshotPlaceholders.map((screen) => (
            <motion.article
              key={screen.title}
              className="screen-card group overflow-hidden rounded-lg border border-blue-100 bg-white/84 shadow-sm shadow-blue-900/5 backdrop-blur-xl"
              variants={cardPop}
              whileHover={{ y: -8, rotate: -0.35, transition: { duration: 0.22 } }}
            >
              <div className="border-b border-blue-100 bg-blue-50/80 px-4 py-3">
                <div className="flex gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-yellow-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-green-300" />
                </div>
              </div>
              <div className="p-5">
                <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-700">
                  {screen.title}
                </p>
                <h3 className="mt-2 text-xl font-black text-slate-950">{screen.subtitle}</h3>
                <div className="mt-5 space-y-3">
                  {screen.lines.map((line, index) => (
                    <div
                      key={line}
                      className="flex items-center justify-between rounded-lg border border-blue-100 bg-[#f8faff] p-3 transition group-hover:border-blue-200"
                    >
                      <span className="text-sm font-semibold text-slate-700">{line}</span>
                      <motion.span
                        className={
                          index === 1
                            ? "h-2 w-14 rounded-lg bg-yellow-300"
                            : "h-2 w-10 rounded-lg bg-blue-300"
                        }
                        initial={{ scaleX: 0.65, transformOrigin: "left" }}
                        whileInView={{ scaleX: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: index * 0.08 }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </motion.article>
          ))}
        </motion.div>
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
          title="화면, 서버, 음성 면접, 질문 생성을 나누어 설계했습니다."
          description="사용자 화면, 로그인과 면접 세션, 실시간 음성 연결, 질문 생성 흐름을 분리해 각 영역의 역할이 명확하도록 구성했습니다."
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
          title="각 기능에 맞는 기술을 선택했습니다."
          description="React 기반 화면, Spring Boot 서버, LiveKit 음성 연결, Bedrock 기반 질문 생성 흐름으로 서비스를 구성했습니다."
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
            <motion.div
              key={member}
              className="glass-panel rounded-lg p-6 text-center"
              variants={cardPop}
              whileHover={{ y: -6, transition: { duration: 0.2 } }}
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-100 text-xl font-black text-yellow-700">
                {member.slice(0, 1)}
              </div>
              <p className="mt-4 text-lg font-black text-slate-950">{member}</p>
            </motion.div>
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
          <InterviewFlow />
          <ScreenshotPlaceholders />
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
