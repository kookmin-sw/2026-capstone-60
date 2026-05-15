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
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, ChevronRight, Square, Wifi, WifiOff, Video, VideoOff, Clock } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";

const TURN_LABEL = {
  user: "내 차례",
  ai: "면접관 발화 중",
  waiting: "대기 중",
};
const TURN_STYLE = {
  user:    "border-blue-200 text-blue-600 bg-blue-50",
  ai:      "border-emerald-200 text-emerald-600 bg-emerald-50",
  waiting: "border-slate-200 text-slate-500 bg-slate-50",
};
const LOG_LABEL = {
  AI: "면접관", QUESTION: "면접관",
  USER: "면접자",
  ALERT: "알림", WARN: "경고",
  ERROR: "오류",
};
const LOG_TEXT_COLOR = {
  AI: "text-blue-600", QUESTION: "text-blue-600",
  USER: "text-emerald-600",
  ALERT: "text-rose-500", WARN: "text-amber-600",
  ERROR: "text-rose-500",
};
const LOG_BG_COLOR = {
  AI: "bg-sky-50", QUESTION: "bg-sky-50",
  USER: "bg-emerald-50",
  ALERT: "bg-rose-50", WARN: "bg-amber-50",
  ERROR: "bg-rose-50",
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
  onToggleMic = () => {},
  onNextQuestion = () => {},
  onEndInterview = () => {},
  canAskNext = true,
  nextLoading = false,
  ending = false,

  eventLog = [],
}) {
  // 카메라 미리보기 토글 (사용자가 끄고 켤 수 있음)
  const [cameraOn, setCameraOn] = useState(true);

  return (
    <div className="fixed inset-0 w-screen h-screen bg-slate-100 flex flex-col overflow-hidden z-40">
      {/* Subtle Grid Background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgb(203 213 225 / 0.4) 1px, transparent 1px),
            linear-gradient(to bottom, rgb(203 213 225 / 0.4) 1px, transparent 1px)
          `,
          backgroundSize: '24px 24px',
        }}
      />

      {/* Status Bar */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="relative flex items-center justify-between px-5 py-3 bg-slate-100/90 border-b border-slate-200 z-10"
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
        <div className="flex-1 flex items-stretch p-4 pb-32 min-w-0">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
            className="w-full flex"
          >
            <div className="w-full bg-white rounded-2xl shadow-lg shadow-slate-200/80 border border-slate-200 overflow-hidden flex">
              {/* Blue Left Border Accent */}
              <div className="w-1 bg-blue-600 shrink-0" />

              <div className="flex-1 p-8 flex flex-col">
                {/* Top Row */}
                <div className="flex items-center justify-between mb-6">
                  <Badge
                    variant="secondary"
                    className="bg-blue-50 text-blue-600 font-semibold text-[11px] tracking-wider uppercase border-0 px-3 py-1"
                  >
                    질문 {String(questionNumber).padStart(2, "0")}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn("text-xs font-semibold px-3 py-1", TURN_STYLE[currentTurn])}
                  >
                    {TURN_LABEL[currentTurn]}
                  </Badge>
                </div>

                {/* Question Text */}
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

                {/* Timer & Progress + Camera */}
                <div className="mt-auto">
                  <div className="flex items-end justify-between mb-5">
                    <div className="flex items-baseline gap-3">
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
                      <span className="text-sm text-slate-400 font-medium mb-2">남은 시간</span>
                    </div>

                    {/* 카메라 미리보기 — 카드 안 우하단 */}
                    <div className="flex flex-col items-end gap-1">
                      <button
                        type="button"
                        onClick={() => setCameraOn((v) => !v)}
                        className={cn(
                          "flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-colors cursor-pointer",
                          cameraOn
                            ? "bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100"
                            : "bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200"
                        )}
                      >
                        {cameraOn ? <Video className="size-3" /> : <VideoOff className="size-3" />}
                        {cameraOn ? "켜짐" : "꺼짐"}
                      </button>
                      <div className="relative w-44 h-28 bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
                        {cameraOn ? (
                          <>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="text-center">
                                <Video className="size-6 text-slate-500 mx-auto mb-1" />
                                <span className="text-[9px] text-slate-500 font-medium">미리보기</span>
                              </div>
                            </div>
                            <div className="absolute top-1.5 right-1.5 flex items-center gap-1 px-1.5 py-0.5 bg-red-500/90 rounded-full">
                              <span className="size-1 bg-white rounded-full animate-pulse" />
                              <span className="text-[8px] text-white font-bold">REC</span>
                            </div>
                          </>
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <VideoOff className="size-6 text-slate-600" />
                          </div>
                        )}
                      </div>
                    </div>
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
          className="w-[300px] bg-transparent border-l border-slate-200/60 flex flex-col"
        >
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-4 py-3 border-b border-slate-200/60">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">진행 로그</h3>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2">
              <div className="space-y-1">
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
                        className={cn(
                          "flex items-start gap-2 p-2 rounded-lg",
                          LOG_BG_COLOR[entry.type] || "bg-slate-100"
                        )}
                      >
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
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-full max-w-2xl px-4"
      >
        <div className="flex items-center justify-center gap-4 px-6 py-4 bg-slate-100/60 backdrop-blur-sm border border-slate-200/60 rounded-2xl">
          {/* Mic Toggle */}
          <div className="relative">
            {isMicOn && (
              <>
                <motion.div
                  animate={{ scale: [1, 1.5], opacity: [0.4, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                  className="absolute inset-0 rounded-full bg-blue-400 pointer-events-none"
                />
                <motion.div
                  animate={{ scale: [1, 1.3], opacity: [0.3, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut", delay: 0.3 }}
                  className="absolute inset-0 rounded-full bg-blue-400 pointer-events-none"
                />
              </>
            )}
            <Button
              variant={isMicOn ? "default" : "secondary"}
              size="icon"
              onClick={onToggleMic}
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

          <div className="w-px h-10 bg-slate-200" />

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

          <div className="w-px h-10 bg-slate-200" />

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
        </div>
      </motion.div>
    </div>
  );
}
