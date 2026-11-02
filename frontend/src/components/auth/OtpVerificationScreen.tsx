import React, { useState, useRef, useEffect } from 'react';
import { ArrowRight, RefreshCw, Phone, Edit2, ShieldCheck, Loader2 } from 'lucide-react';

interface OtpVerificationScreenProps {
  phoneNumber: string; // e.g. "+919876543210" or "9876543210"
  onVerifyOtp: (otpCode: string) => Promise<void>;
  onResendOtp: () => Promise<void>;
  onChangePhone: () => void;
  isLoading: boolean;
  errorMsg: string;
}

export const OtpVerificationScreen: React.FC<OtpVerificationScreenProps> = ({
  phoneNumber,
  onVerifyOtp,
  onResendOtp,
  onChangePhone,
  isLoading,
  errorMsg,
}) => {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [timerSeconds, setTimerSeconds] = useState(30);
  const [isResending, setIsResending] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus the first input box on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Resend countdown timer
  useEffect(() => {
    if (timerSeconds <= 0) return;
    const interval = setInterval(() => {
      setTimerSeconds((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timerSeconds]);

  // Format masked phone: e.g. +91 93477 92898 -> +91 ••••• ••898
  const formatMaskedPhone = (raw: string) => {
    const cleanDigits = raw.replace(/\D/g, '');
    const ten = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : cleanDigits;
    if (ten.length === 10) {
      return `+91 ••••• ••${ten.slice(-3)}`;
    }
    return raw;
  };

  const handleDigitChange = (index: number, value: string) => {
    const numeric = value.replace(/\D/g, '');
    if (!numeric) {
      // Cleared
      const newDigits = [...digits];
      newDigits[index] = '';
      setDigits(newDigits);
      return;
    }

    // Single digit input
    const char = numeric.slice(-1);
    const newDigits = [...digits];
    newDigits[index] = char;
    setDigits(newDigits);

    // Auto-advance to next input
    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const newDigits = [...digits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] || '';
    }
    setDigits(newDigits);

    const nextIndex = Math.min(pasted.length, 5);
    inputRefs.current[nextIndex]?.focus();
  };

  const fullOtp = digits.join('');
  const isOtpComplete = fullOtp.length === 6;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOtpComplete || isLoading) return;
    onVerifyOtp(fullOtp);
  };

  const handleResend = async () => {
    if (timerSeconds > 0 || isResending) return;
    try {
      setIsResending(true);
      await onResendOtp();
      setTimerSeconds(30);
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-[#0c831f] flex items-center justify-center mx-auto shadow-xs border border-emerald-100">
          <ShieldCheck className="w-7 h-7 stroke-[2.2]" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
          Verify Your Mobile Number
        </h2>
        <div className="flex items-center justify-center gap-2 text-xs text-slate-500 font-medium">
          <span>OTP sent to</span>
          <span className="font-extrabold text-slate-800 tracking-wider">
            {formatMaskedPhone(phoneNumber)}
          </span>
          <button
            type="button"
            onClick={onChangePhone}
            className="text-[#0c831f] hover:text-emerald-700 font-bold ml-1 flex items-center gap-0.5 transition-colors cursor-pointer"
            title="Change Mobile Number"
          >
            <Edit2 className="w-3 h-3" />
            <span>Edit</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-2xl flex items-center gap-2">
          <span>⚠️</span>
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Six Individual OTP Input Boxes */}
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          {digits.map((digit, idx) => (
            <input
              key={idx}
              ref={(el) => (inputRefs.current[idx] = el)}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              value={digit}
              onChange={(e) => handleDigitChange(idx, e.target.value)}
              onKeyDown={(e) => handleKeyDown(idx, e)}
              onPaste={handlePaste}
              disabled={isLoading}
              className={`w-11 h-13 sm:w-13 sm:h-14 text-center font-black text-xl sm:text-2xl rounded-2xl border-2 transition-all outline-none select-none ${
                digit
                  ? 'border-[#0c831f] bg-emerald-50/50 text-slate-900 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 focus:border-[#0c831f] focus:ring-4 focus:ring-emerald-500/15'
              } disabled:opacity-50`}
            />
          ))}
        </div>

        {/* Verify & Continue Button */}
        <button
          type="submit"
          disabled={!isOtpComplete || isLoading}
          className="w-full py-3.5 bg-[#0c831f] hover:bg-emerald-700 active:scale-98 text-white font-extrabold rounded-2xl transition-all shadow-md shadow-emerald-700/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Verifying OTP...</span>
            </>
          ) : (
            <>
              <span>Verify & Continue</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        {/* Resend OTP & Change Number Controls */}
        <div className="flex items-center justify-between pt-1 text-xs">
          <button
            type="button"
            onClick={onChangePhone}
            disabled={isLoading}
            className="text-slate-500 hover:text-slate-800 font-bold flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Change Number</span>
          </button>

          {timerSeconds > 0 ? (
            <span className="text-slate-400 font-semibold text-[11px]">
              Resend OTP in <span className="font-extrabold text-slate-700">{timerSeconds}s</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending || isLoading}
              className="text-[#0c831f] hover:text-emerald-700 font-black flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
              <span>Resend OTP</span>
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
