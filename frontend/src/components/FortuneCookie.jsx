import { useState } from "react";

const FORTUNES = [
  "오늘의 면접은 분명 잘 될 거예요. 당신의 노력이 빛날 시간입니다! ✨",
  "자신감을 가지세요. 당신은 이미 충분히 준비되어 있어요! 💪",
  "긴장은 열정의 또 다른 이름이에요. 그 에너지로 면접장을 장악하세요! 🎯",
  "오늘 합격 소식이 들려올 것 같은 강한 예감이 있어요! 🏆",
  "당신의 한마디 한마디가 면접관의 마음을 움직일 거예요! 🌟",
  "이 면접은 당신을 위해 마련된 무대예요. 주인공처럼 빛나세요! 🎬",
  "실수를 두려워하지 마세요. 솔직함이 당신의 무기가 될 수 있어요! 😊",
  "오늘의 도전이 내일의 자신감이 됩니다. 힘내세요! 🌈",
  "준비한 만큼 결과도 반드시 따라옵니다. 믿어요! 📚",
  "면접관도 사람이에요. 진심은 언제나 통해요! ❤️",
  "합격은 이미 당신 것이에요. 오늘은 그걸 확인하는 날이랍니다! 🔑",
  "포기하지 않고 여기까지 온 당신, 이미 정말 대단해요! 🥊",
  "당신의 경험과 열정은 세상에 단 하나뿐인 특별함이에요! 💎",
  "오늘 면접이 멋진 새 챕터의 첫 줄이 될 거예요! 🚀",
  "스스로를 믿으세요. 이 기회는 당신이 받을 자격이 충분해요! 🌙",
  "면접관은 정답이 아니라 바로 '당신'을 찾고 있어요! 🎪",
  "모든 질문에는 당신만의 멋진 이야기가 담겨 있어요! 📖",
  "오늘 하루, 당신이 준비해온 모든 것이 꽃피울 거예요! 🌸",
  "어려운 질문일수록 당신이 빛날 기회예요. 즐기세요! ⚡",
  "지금 이 순간도 성장하고 있어요. 당신은 충분히 훌륭해요! 🌱",
];

export default function FortuneCookie() {
  const [phase, setPhase] = useState("idle"); // idle | shaking | revealed
  const [fortune, setFortune] = useState(null);

  const handleCrack = () => {
    if (phase !== "idle") return;
    setPhase("shaking");
    const msg = FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
    setTimeout(() => {
      setFortune(msg);
      setPhase("revealed");
    }, 750);
  };

  const handleReset = () => {
    setPhase("idle");
    setFortune(null);
  };

  return (
    <div className="fortune-wrap">
      <p className="eyebrow" style={{ textAlign: "center" }}>Fortune Cookie</p>
      <h3 className="fortune-title">면접 전 행운 쿠키</h3>
      <p className="subtext" style={{ textAlign: "center" }}>
        쿠키를 깨면 오늘의 응원 메시지가 나와요 🥠
      </p>

      {/* Cookie stage */}
      <div className="fortune-stage" onClick={phase === "idle" ? handleCrack : undefined}>
        {phase !== "revealed" ? (
          <span
            className={`fortune-emoji ${phase === "idle" ? "floating" : "shaking"}`}
            role="img"
            aria-label="fortune cookie"
          >
            🥠
          </span>
        ) : (
          <span className="fortune-emoji opened" role="img" aria-label="sparkle">
            ✨
          </span>
        )}

        {phase === "idle" && (
          <p className="fortune-hint">클릭하거나 아래 버튼을 눌러보세요</p>
        )}
      </div>

      {/* Fortune message */}
      {phase === "revealed" && fortune && (
        <div className="fortune-message">
          <div className="fortune-paper-top" />
          <p>{fortune}</p>
        </div>
      )}

      {/* CTA */}
      <div className="fortune-cta">
        {phase === "idle" && (
          <button className="fortune-btn primary-btn" type="button" onClick={handleCrack}>
            🥠 쿠키 깨기
          </button>
        )}
        {phase === "revealed" && (
          <button className="ghost-btn" type="button" onClick={handleReset}>
            🔄 새 쿠키 뽑기
          </button>
        )}
      </div>
    </div>
  );
}
