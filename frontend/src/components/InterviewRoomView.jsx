/**
 * InterviewRoomView — v0.dev 시안의 interview-room-showcase.tsx 를
 * 거의 1:1 그대로 이식한 시각 컴포넌트.
 *
 * 변경점:
 *   - TypeScript → JSX
 *   - props 가 외부(InterviewRoom 컨테이너)에서 주입됨
 *   - 최상위 div: h-screen → fixed inset-0 (부모 chain 의 height 영향 차단)
 *   - SYSTEM 로그는 컨테이너에서 미리 필터링되어 들어옴
 */
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Mic, MicOff, ChevronRight, Square, Wifi, WifiOff, Clock } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";

const TURN_LABEL = {
  user: "내 차례",
  ai: "면접관 발화 중",
  waiting: "대기 중",
};
const TURN_STYLE = {
  user:    "border-2 border-white/90 text-blue-600 bg-white/40 backdrop-blur-md",
  ai:      "border-2 border-white/90 text-emerald-600 bg-white/40 backdrop-blur-md",
  waiting: "border-2 border-white/90 text-slate-500 bg-white/40 backdrop-blur-md",
};
const LOG_LABEL = {
  AI: "면접관", QUESTION: "면접관",
  USER: "면접자",
  ALERT: "알림", WARN: "경고",
  ERROR: "오류",
};
const LOG_TEXT_COLOR = {
  AI: "text-blue-700", QUESTION: "text-blue-700",
  USER: "text-emerald-700",
  ALERT: "text-rose-500", WARN: "text-amber-600",
  ERROR: "text-rose-500",
};
const LOG_BG_COLOR = {
  AI: "bg-sky-50/60", QUESTION: "bg-sky-50/60",
  USER: "bg-amber-50/60",
  ALERT: "bg-rose-50/60", WARN: "bg-amber-50/60",
  ERROR: "bg-rose-50/60",
};

export default function InterviewRoomView({
  isConnected = false,
  sessionId = "",
  totalTimeRemaining = "--:--",
  totalTimeProgress = 0,

  questionNumber = 1,
  questionText = "",
  currentTurn = "waiting",

  answerTimeRemaining = "--:--",
  answerTimeProgress = 0,
  isUnderTen = false,
  showAnswerTimer = false,

  warningVisible = false,
  errorMessage = "",

  isMicOn = false,
  isMicToggleDisabled = false,
  onToggleMic = () => {},
  onNextQuestion = () => {},
  onEndInterview = () => {},
  canAskNext = true,
  nextLoading = false,
  ending = false,

  eventLog = [],

  // 배경 블롭 애니메이션 상태.
  // 현재는 2-state ("generating" / "answering") 만 사용. 추후 LiveKit audio
  // 트랙 감지로 "speaking" 분리 가능하도록 인터페이스만 3-state 로 열어둔다.
  ambientState = "answering",

  targetIdentity = null,
  myIdentity = null,
  isGroup = false,
  isHost = true,
}) {
  const turnHint = isGroup && targetIdentity
    ? (targetIdentity === myIdentity ? "지금 답변할 차례입니다" : `답변 차례: ${targetIdentity}`)
    : null;
  // prefers-reduced-motion 사용자에게는 모션 없이 정적 배경만 노출
  const reduceMotion = useReducedMotion();

  // 블롭 애니메이션 variants (우상단 yellow / 좌하단 blue)
  // x/y 는 viewport 단위라 화면 크기와 무관하게 중앙으로 모임.
  // answering(사용자 답변) 상태에서 노란 블롭이 질문 텍스트를 가리지 않도록
  // base 위치를 좌→우 대칭 배치하고, generating/speaking 시 중앙으로 모이는
  // x 방향도 따라 뒤집는다.
  const yellowAnimate = reduceMotion
    ? { x: 0, y: 0, scale: 1, opacity: 0.5 }
    : ambientState === "generating"
      ? { x: "-28vw", y: "22vh", scale: [1, 1.12, 1], opacity: [0.5, 0.25, 0.5] }
      : ambientState === "speaking"
        ? { x: "-10vw", y: "8vh", scale: [1, 1.04, 1], opacity: [0.5, 0.65, 0.5] }
        : { x: 0, y: 0, scale: 1, opacity: 0.5 };

  const blueAnimate = reduceMotion
    ? { x: 0, y: 0, scale: 1, opacity: 0.4 }
    : ambientState === "generating"
      ? { x: "28vw", y: "-22vh", scale: [1, 1.12, 1], opacity: [0.4, 0.2, 0.4] }
      : ambientState === "speaking"
        ? { x: "10vw", y: "-8vh", scale: [1, 1.04, 1], opacity: [0.4, 0.55, 0.4] }
        : { x: 0, y: 0, scale: 1, opacity: 0.4 };

  // 모션 사이클: generating 빠른 박동, speaking 잔잔한 호흡, answering 정적
  const blobTransition =
    reduceMotion || ambientState === "answering"
      ? { duration: 1, ease: "easeOut" }
      : ambientState === "generating"
        ? {
            x: { duration: 0.9, ease: "easeOut" },
            y: { duration: 0.9, ease: "easeOut" },
            scale: { duration: 1.3, repeat: Infinity, ease: "easeInOut" },
            opacity: { duration: 1.3, repeat: Infinity, ease: "easeInOut" },
          }
        : {
            x: { duration: 1.2, ease: "easeOut" },
            y: { duration: 1.2, ease: "easeOut" },
            scale: { duration: 3.5, repeat: Infinity, ease: "easeInOut" },
            opacity: { duration: 3.5, repeat: Infinity, ease: "easeInOut" },
          };

  return (
    <div className="fixed inset-0 w-screen h-screen bg-slate-100 flex flex-col overflow-hidden z-40">
      {/* Aurora Blobs (ambientState 에 따라 위치/박동/투명도 변화) */}
      <motion.div
        className="absolute -top-64 -right-64 w-[760px] h-[760px] rounded-full bg-yellow-300 pointer-events-none"
        style={{ filter: 'blur(110px)', willChange: 'transform, opacity', transform: 'translateZ(0)' }}
        animate={yellowAnimate}
        transition={blobTransition}
      />
      <motion.div
        className="absolute -bottom-64 -left-64 w-[760px] h-[760px] rounded-full bg-blue-500 pointer-events-none"
        style={{ filter: 'blur(110px)', willChange: 'transform, opacity', transform: 'translateZ(0)' }}
        animate={blueAnimate}
        transition={blobTransition}
      />

      {/* Concentric Circle Strokes */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        <div
          className="absolute rounded-full border border-slate-400/15"
          style={{ width: '170vmin', height: '170vmin' }}
        />
        <div
          className="absolute rounded-full border border-slate-400/25"
          style={{ width: '135vmin', height: '135vmin' }}
        />
        <div
          className="absolute rounded-full border border-slate-400/30"
          style={{ width: '100vmin', height: '100vmin' }}
        />
        <div
          className="absolute rounded-full border border-slate-400/35"
          style={{ width: '70vmin', height: '70vmin' }}
        />
        <div
          className="absolute rounded-full border border-slate-400/40"
          style={{ width: '45vmin', height: '45vmin' }}
        />
      </div>

      {/* Status Bar */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="relative flex items-center justify-between px-5 py-3 bg-white/65 backdrop-blur-2xl backdrop-saturate-150 border-b-[3px] border-white/90 z-10"
      >
        {/* Left: Connection Status & Session ID */}
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full",
            isConnected ? "bg-emerald-50" : "bg-amber-50"
          )}>
            <span
              className={cn(
                "size-2 rounded-full animate-pulse",
                isConnected ? "bg-emerald-500" : "bg-amber-400"
              )}
            />
            {isConnected
              ? <Wifi className="size-3.5 text-emerald-600" />
              : <WifiOff className="size-3.5 text-amber-600" />
            }
            <span className={cn(
              "text-xs font-medium",
              isConnected ? "text-emerald-700" : "text-amber-700"
            )}>
              {isConnected ? "연결됨" : "연결 확인 중"}
            </span>
          </div>
          <span className="font-[family-name:var(--font-jetbrains)] text-[11px] text-slate-400 tracking-wider">
            {sessionId}
          </span>
        </div>

        {/* Center */}
        <div />

        {/* Right: Total Time Remaining with Progress */}
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-lg">
            <Clock className="size-4 text-slate-500" />
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">전체</span>
            <span className="font-[family-name:var(--font-jetbrains)] text-lg font-bold text-slate-800 tabular-nums">
              {totalTimeRemaining}
            </span>
          </div>
          <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-slate-400 rounded-full transition-all duration-500"
              style={{ width: `${totalTimeProgress}%` }}
            />
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <div className="flex-1 flex relative z-10 min-h-0">
        {/* Question Card Area */}
        <div className="flex-1 flex items-stretch px-10 pt-10 pb-40 min-w-0">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
            className="w-full flex"
          >
            <div className="w-full bg-white/20 backdrop-blur-2xl backdrop-saturate-150 rounded-2xl shadow-2xl shadow-blue-900/15 border-[3px] border-white/90 overflow-hidden flex" style={{ outline: '1.5px solid rgba(255,255,255,0.6)', outlineOffset: '-6px' }}>
              <div className="flex-1 p-8 flex flex-col">
                {/* Top Row */}
                <div className="flex items-center justify-between mb-6">
                  <Badge
                    variant="secondary"
                    className="bg-white/40 backdrop-blur-md text-blue-600 font-semibold text-sm tracking-wider uppercase border-2 border-white/90 px-5 py-2"
                  >
                    질문 {String(questionNumber).padStart(2, "0")}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn("text-sm font-semibold px-5 py-2", TURN_STYLE[currentTurn])}
                  >
                    {TURN_LABEL[currentTurn]}
                  </Badge>
                </div>

                {/* Question Text */}
                {turnHint && (
                  <p className="text-sm font-medium text-blue-700 mb-3">{turnHint}</p>
                )}
                {!isHost && isGroup && (
                  <p className="text-xs text-slate-500 mb-3">관전 모드 — 다음/종료는 호스트만 가능합니다</p>
                )}
                <AnimatePresence mode="wait">
                  <motion.h2
                    key={questionText}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3 }}
                    className="text-[26px] leading-[1.5] font-semibold text-slate-900 tracking-tight text-pretty mb-8"
                  >
                    {questionText || <span className="text-slate-400">질문을 기다리는 중...</span>}
                  </motion.h2>
                </AnimatePresence>

                {/* Warning Banner */}
                <AnimatePresence>
                  {warningVisible && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-700 font-medium mb-4"
                    >
                      ⏱ 10초 후 답변이 종료됩니다. 핵심 결론을 먼저 말해주세요.
                    </motion.div>
                  )}
                </AnimatePresence>

                {errorMessage && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-700 mb-4">
                    {errorMessage}
                  </div>
                )}

                {/* Spacer */}
                <div className="flex-1" />

                {/* Timer & Progress */}
                <div className="mt-auto mb-12">
                  <div className="flex flex-col items-center mb-8">
                    <motion.span
                      key={answerTimeRemaining}
                      initial={{ scale: 1.02 }}
                      animate={{ scale: 1 }}
                      className={cn(
                        "font-[family-name:var(--font-jetbrains)] text-[68px] font-bold tabular-nums tracking-tighter leading-none",
                        isUnderTen ? "text-rose-500" : "text-slate-800"
                      )}
                    >
                      {showAnswerTimer ? answerTimeRemaining : "--:--"}
                    </motion.span>
                    <span className="text-sm text-slate-400 font-medium mt-1">남은 시간</span>
                  </div>

                  <div className="relative">
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <motion.div
                        animate={{ width: `${answerTimeProgress}%` }}
                        transition={{ duration: 0.5, ease: "linear" }}
                        className={cn(
                          "h-full rounded-full transition-colors relative",
                          isUnderTen ? "bg-rose-400" : "bg-blue-500"
                        )}
                        style={{
                          boxShadow: isUnderTen
                            ? '0 0 12px rgba(251, 113, 133, 0.6)'
                            : '0 0 12px rgba(59, 130, 246, 0.5)',
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Side Panel */}
        <motion.aside
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.2 }}
          className="w-[300px] mt-10 mr-10 mb-10 bg-white/20 backdrop-blur-2xl backdrop-saturate-150 border-[3px] border-white/90 rounded-2xl shadow-2xl shadow-blue-900/15 flex flex-col overflow-hidden"
          style={{ outline: '1.5px solid rgba(255,255,255,0.6)', outlineOffset: '-6px' }}
        >
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-4 py-3 border-b border-white/30">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">진행 로그</h3>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2">
              <div>
                {eventLog.length === 0 ? (
                  <p className="text-xs text-slate-400 px-2 py-3">아직 이벤트가 없습니다.</p>
                ) : (
                  <AnimatePresence initial={false}>
                    {eventLog.map((entry, index) => (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: index * 0.02 }}
                      >
                        <div className="flex items-start gap-2 p-2">
                          <span className={cn(
                            "shrink-0 font-semibold text-[11px] w-10 text-center",
                            LOG_TEXT_COLOR[entry.type] || "text-slate-500"
                          )}>
                            {LOG_LABEL[entry.type] || entry.type}
                          </span>
                          <span className="text-slate-700 leading-relaxed flex-1 text-xs font-medium min-w-0 break-words">
                            {entry.text}
                          </span>
                          <span className="font-[family-name:var(--font-jetbrains)] text-slate-500 shrink-0 text-[10px]">
                            {entry.timestamp}
                          </span>
                        </div>
                        {index < eventLog.length - 1 && (
                          <div className="mx-2 h-[2px] rounded-full bg-gradient-to-r from-transparent via-black/15 to-transparent" />
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </div>
          </div>
        </motion.aside>
      </div>

      {/* Floating Action Bar */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut", delay: 0.3 }}
        className="absolute bottom-10 left-10 right-[380px] z-20"
      >
        <div className="flex items-center justify-center gap-10 px-6 py-4 bg-white/20 backdrop-blur-3xl backdrop-saturate-200 border-[3px] border-white/90 rounded-2xl shadow-2xl shadow-blue-900/20" style={{ outline: '1.5px solid rgba(255,255,255,0.6)', outlineOffset: '-6px' }}>
          {/* End Interview */}
          <Button
            variant="ghost"
            onClick={onEndInterview}
            disabled={ending}
            className="rounded-xl px-8 h-14 text-rose-500 hover:bg-rose-50 hover:text-rose-600 gap-2 font-medium"
          >
            {ending ? (
              <>
                <span className="w-4 h-4 border-2 border-rose-300 border-t-rose-500 rounded-full animate-spin" />
                <span className="text-sm">종료 중</span>
              </>
            ) : (
              <>
                <Square className="size-4 fill-current" />
                <span className="text-sm">면접 종료</span>
              </>
            )}
          </Button>

          {/* Mic Toggle */}
          <div className="relative">
            {isMicOn && (
              <>
                <motion.div
                  animate={{ scale: [1, 1.6], opacity: [0, 0.45, 0] }}
                  transition={{
                    duration: 1.8,
                    repeat: Infinity,
                    ease: "easeOut",
                    times: [0, 0.3, 1],
                  }}
                  className="absolute inset-0 rounded-full bg-blue-400 pointer-events-none"
                />
                <motion.div
                  animate={{ scale: [1, 1.6], opacity: [0, 0.45, 0] }}
                  transition={{
                    duration: 1.8,
                    repeat: Infinity,
                    ease: "easeOut",
                    times: [0, 0.3, 1],
                    delay: 0.9,
                  }}
                  className="absolute inset-0 rounded-full bg-blue-400 pointer-events-none"
                />
              </>
            )}
            <Button
              variant={isMicOn ? "default" : "secondary"}
              size="icon"
              onClick={onToggleMic}
              disabled={isMicToggleDisabled || ending}
              className={cn(
                "rounded-full size-14 relative z-10 transition-all",
                isMicOn
                  ? "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-600"
              )}
            >
              {isMicOn ? <Mic className="size-6" /> : <MicOff className="size-6" />}
            </Button>
          </div>

          {/* Next Question */}
          <Button
            variant="ghost"
            onClick={onNextQuestion}
            disabled={!canAskNext || nextLoading || ending}
            className="rounded-xl px-8 h-14 text-slate-700 hover:bg-slate-100 gap-2 font-medium"
          >
            {nextLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
                <span className="text-sm">요청 중</span>
              </>
            ) : (
              <>
                <span className="text-sm">다음 질문</span>
                <ChevronRight className="size-4" />
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
