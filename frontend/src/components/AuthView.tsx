import React, { useState } from 'react';
import type { UserAccount, ToastMessage } from '../types';

export type AuthMode = 'login' | 'register' | 'forgot';

interface AuthViewProps {
  initialMode: AuthMode;
  onSuccess: (user: UserAccount, mode: 'login' | 'register') => void;
  onBackHome: () => void;
  onAddToast: (toast: Omit<ToastMessage, 'id'>) => void;
}

interface StoredUser extends UserAccount {
  password?: string;
}

const STORAGE_USERS_KEY = 'tr_registered_users';

function getStoredUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(STORAGE_USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredUsers(users: StoredUser[]) {
  try {
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
  } catch {
    // ignore storage errors
  }
}

const AuthView: React.FC<AuthViewProps> = ({
  initialMode,
  onSuccess,
  onBackHome,
  onAddToast,
}) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [selectedLang, setSelectedLang] = useState<'VN' | 'EN'>('VN');
  const [isLangOpen, setIsLangOpen] = useState(false);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [autoLogin, setAutoLogin] = useState(true);
  const [agreedTerms, setAgreedTerms] = useState(false);

  // Password visibility toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setErrorMsg('');
    setPassword('');
    setConfirmPassword('');
  };

  // Validation states matching CTicket disabled/enabled button behavior
  const isLoginReady = email.trim().length > 0 && password.length > 0;
  const isRegisterReady =
    email.trim().length > 0 &&
    password.length >= 6 &&
    confirmPassword.length >= 6 &&
    agreedTerms;
  const isForgotReady = email.trim().length > 0;

  const handleGoogleContinue = () => {
    const googleUser: UserAccount = {
      name: 'Hiếu Nguyễn',
      email: 'hieunguyen@gmail.com',
      provider: 'google',
    };
    onSuccess(googleUser, mode === 'register' ? 'register' : 'login');
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail.includes('@')) {
      setErrorMsg('Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }

    const users = getStoredUsers();
    const matched = users.find((u) => u.email.toLowerCase() === trimmedEmail);

    if (matched && matched.password && matched.password !== password) {
      setErrorMsg('Mật khẩu không chính xác. Vui lòng kiểm tra lại.');
      return;
    }

    const displayName =
      matched?.name ||
      trimmedEmail
        .split('@')[0]
        .replace(/[._-]/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase());

    onSuccess(
      {
        name: displayName,
        email: trimmedEmail,
        provider: 'email',
      },
      'login'
    );
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail.includes('@')) {
      setErrorMsg('Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (!agreedTerms) {
      setErrorMsg('Vui lòng đồng ý với Điều kiện và điều khoản.');
      return;
    }

    const users = getStoredUsers();
    const existingIdx = users.findIndex((u) => u.email.toLowerCase() === trimmedEmail);

    const displayName = trimmedEmail
      .split('@')[0]
      .replace(/[._-]/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());

    const newUser: StoredUser = {
      name: displayName,
      email: trimmedEmail,
      password,
      provider: 'email',
    };

    if (existingIdx >= 0) {
      users[existingIdx] = newUser;
    } else {
      users.push(newUser);
    }
    saveStoredUsers(users);

    onSuccess(
      {
        name: newUser.name,
        email: newUser.email,
        provider: 'email',
      },
      'register'
    );
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim().includes('@')) {
      setErrorMsg('Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }
    onAddToast({
      message: `Đã gửi mã khôi phục mật khẩu tới ${email.trim()}. Vui lòng kiểm tra hộp thư.`,
      type: 'info',
    });
    switchMode('login');
  };

  const renderEnvelopeIcon = () => (
    <span className="ct-auth-input-icon-left" aria-hidden="true">
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M2 7L10.1649 12.7154C10.8261 13.1783 11.1567 13.4097 11.5163 13.4993C11.8339 13.5785 12.1661 13.5785 12.4837 13.4993C12.8433 13.4097 13.1739 13.1783 13.8351 12.7154L22 7M6.8 20H17.2C18.8802 20 19.7202 20 20.362 19.673C20.9265 19.3854 21.3854 18.9265 21.673 18.362C22 17.7202 22 16.8802 22 15.2V8.8C22 7.11984 22 6.27976 21.673 5.63803C21.3854 5.07354 20.9265 4.6146 20.362 4.32698C19.7202 4 18.8802 4 17.2 4H6.8C5.11984 4 4.27976 4 3.63803 4.32698C3.07354 4.6146 2.6146 5.07354 2.32698 5.63803C2 6.27976 2 7.11984 2 8.8V15.2C2 16.8802 2 17.7202 2.32698 18.362C2.6146 18.9265 3.07354 19.3854 3.63803 19.673C4.27976 20 5.11984 20 6.8 20Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );

  const renderLockIcon = () => (
    <span className="ct-auth-input-icon-left" aria-hidden="true">
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M17 10V8C17 5.23858 14.7614 3 12 3C9.23858 3 7 5.23858 7 8V10M12 14.5V16.5M8.8 21H15.2C16.8802 21 17.7202 21 18.362 20.673C18.9265 20.3854 19.3854 19.9265 19.673 19.362C20 18.7202 20 17.8802 20 16.2V14.8C20 13.1198 20 12.2798 19.673 11.638C19.3854 11.0735 18.9265 10.6146 18.362 10.327C17.7202 10 16.8802 10 15.2 10H8.8C7.11984 10 6.27976 10 5.63803 10.327C5.07354 10.6146 4.6146 11.0735 4.32698 11.638C4 12.2798 4 13.1198 4 14.8V16.2C4 17.8802 4 18.7202 4.32698 19.362C4.6146 19.9265 5.07354 20.3854 5.63803 20.673C6.27976 21 7.11984 21 8.8 21Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );

  const renderEyeToggle = (visible: boolean, onToggle: () => void) => (
    <button
      type="button"
      className="ct-auth-eye-btn"
      onClick={onToggle}
      tabIndex={-1}
      aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
    >
      {visible ? (
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 3l18 18M10.584 10.587a2 2 0 002.828 2.83M9.363 5.365A9.466 9.466 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21m-4.625-4.625A9.956 9.956 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 012.69-4.362"
          />
        </svg>
      ) : (
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M2.42012 12.7132C2.28394 12.4975 2.21584 12.3897 2.17772 12.2234C2.14909 12.0985 2.14909 11.9015 2.17772 11.7766C2.21584 11.6103 2.28394 11.5025 2.42012 11.2868C3.54553 9.50484 6.8954 5 12.0004 5C17.1054 5 20.4553 9.50484 21.5807 11.2868C21.7169 11.5025 21.785 11.6103 21.8231 11.7766C21.8517 11.9015 21.8517 12.0985 21.8231 12.2234C21.785 12.3897 21.7169 12.4975 21.5807 12.7132C20.4553 14.4952 17.1054 19 12.0004 19C6.8954 19 3.54553 14.4952 2.42012 12.7132Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M12.0004 15C13.6573 15 15.0004 13.6569 15.0004 12C15.0004 10.3431 13.6573 9 12.0004 9C10.3435 9 9.0004 10.3431 9.0004 12C9.0004 13.6569 10.3435 15 12.0004 15Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );

  const renderGoogleButton = () => (
    <button
      type="button"
      className="ct-auth-google-btn"
      onClick={handleGoogleContinue}
    >
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <g clipPath="url(#google_clip)">
          <path
            d="M23.766 12.2765C23.766 11.4608 23.6999 10.6406 23.5588 9.83813H12.24V14.4591H18.7217C18.4528 15.9495 17.5885 17.2679 16.323 18.1056V21.104H20.19C22.4608 19.014 23.766 15.9274 23.766 12.2765Z"
            fill="#4285F4"
          />
          <path
            d="M12.24 24.0008C15.4764 24.0008 18.2058 22.9382 20.1944 21.1039L16.3274 18.1055C15.2516 18.8375 13.8626 19.252 12.2444 19.252C9.11376 19.252 6.45934 17.1399 5.50693 14.3003H1.51648V17.3912C3.55359 21.4434 7.70278 24.0008 12.24 24.0008Z"
            fill="#34A853"
          />
          <path
            d="M5.50253 14.3002C4.99987 12.8099 4.99987 11.196 5.50253 9.70569V6.61475H1.51649C-0.18551 10.0055 -0.18551 14.0004 1.51649 17.3912L5.50253 14.3002Z"
            fill="#FBBC04"
          />
          <path
            d="M12.24 4.74966C13.9508 4.7232 15.6043 5.36697 16.8433 6.54867L20.2694 3.12262C18.1 1.0855 15.2207 -0.034466 12.24 0.000808666C7.70277 0.000808666 3.55359 2.55822 1.51648 6.61481L5.50252 9.70575C6.45052 6.86173 9.10935 4.74966 12.24 4.74966Z"
            fill="#EA4335"
          />
        </g>
        <defs>
          <clipPath id="google_clip">
            <rect width="24" height="24" fill="white" />
          </clipPath>
        </defs>
      </svg>
      <span>Tiếp tục với Google</span>
    </button>
  );

  return (
    <div className="ct-auth-page">
      {/* Top Bar: TicketRush Brand on Left, Language Pill on Right */}
      <header className="ct-auth-topbar">
        <a
          href="#"
          className="ct-brand"
          onClick={(e) => {
            e.preventDefault();
            onBackHome();
          }}
        >
          <span className="ct-logo-ticket">Ticket</span>
          <span className="ct-logo-rush">Rush</span>
        </a>

        <div className="ct-lang-selector-wrapper">
          <button
            type="button"
            className="ct-auth-lang-pill"
            onClick={() => setIsLangOpen(!isLangOpen)}
          >
            <span className="ct-lang-code">{selectedLang}</span>
            <svg
              className="ct-lang-chevron"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>

          {isLangOpen && (
            <div className="ct-lang-dropdown-menu">
              <div
                className={`ct-lang-option ${selectedLang === 'VN' ? 'active' : ''}`}
                onClick={() => {
                  setSelectedLang('VN');
                  setIsLangOpen(false);
                }}
              >
                <span className="ct-lang-option-text">Tiếng Việt (VN)</span>
                {selectedLang === 'VN' && (
                  <svg
                    className="ct-lang-check"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#60A5FA"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                )}
              </div>

              <div
                className={`ct-lang-option ${selectedLang === 'EN' ? 'active' : ''}`}
                onClick={() => {
                  setSelectedLang('EN');
                  setIsLangOpen(false);
                }}
              >
                <span className="ct-lang-option-text">English (EN)</span>
                {selectedLang === 'EN' && (
                  <svg
                    className="ct-lang-check"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#60A5FA"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Centered Card */}
      <div className="ct-auth-center-wrap">
        <div className="ct-auth-card">
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} noValidate>
              <h1 className="ct-auth-title">Đăng nhập</h1>

              <div className="ct-auth-social-wrap">{renderGoogleButton()}</div>

              <div className="ct-auth-divider">
                <span>Hoặc</span>
              </div>

              {errorMsg && <div className="ct-auth-error-banner">{errorMsg}</div>}

              <div className="ct-auth-fields">
                <div className="ct-auth-input-wrap">
                  {renderEnvelopeIcon()}
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    placeholder="Nhập địa chỉ email"
                    className="ct-auth-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="ct-auth-input-wrap">
                  {renderLockIcon()}
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    autoComplete="current-password"
                    placeholder="Nhập mật khẩu"
                    className="ct-auth-input ct-auth-input-has-right"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  {renderEyeToggle(showPassword, () => setShowPassword(!showPassword))}
                </div>
              </div>

              <div className="ct-auth-options-row">
                <label className="ct-auth-checkbox-label">
                  <input
                    type="checkbox"
                    checked={autoLogin}
                    onChange={(e) => setAutoLogin(e.target.checked)}
                    className="ct-auth-checkbox"
                  />
                  <span>Tự động đăng nhập</span>
                </label>

                <button
                  type="button"
                  className="ct-auth-link-btn"
                  onClick={() => switchMode('forgot')}
                >
                  Quên mật khẩu?
                </button>
              </div>

              <button
                type="submit"
                disabled={!isLoginReady}
                className={`ct-auth-submit-btn ${isLoginReady ? 'ready' : 'disabled'}`}
              >
                Đăng nhập
              </button>

              <div className="ct-auth-switch-row">
                <span>Bạn chưa có tài khoản?&nbsp;</span>
                <button
                  type="button"
                  className="ct-auth-link-btn"
                  onClick={() => switchMode('register')}
                >
                  Đăng ký ngay
                </button>
              </div>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} noValidate>
              <h1 className="ct-auth-title">Đăng ký tài khoản</h1>

              <div className="ct-auth-social-wrap">{renderGoogleButton()}</div>

              <div className="ct-auth-divider">
                <span>Hoặc</span>
              </div>

              {errorMsg && <div className="ct-auth-error-banner">{errorMsg}</div>}

              <div className="ct-auth-fields">
                <div className="ct-auth-input-wrap">
                  {renderEnvelopeIcon()}
                  <input
                    type="email"
                    name="email"
                    autoComplete="off"
                    placeholder="Nhập địa chỉ email"
                    className="ct-auth-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="ct-auth-input-wrap">
                  {renderLockIcon()}
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    autoComplete="new-password"
                    placeholder="Nhập mật khẩu"
                    className="ct-auth-input ct-auth-input-has-right"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  {renderEyeToggle(showPassword, () => setShowPassword(!showPassword))}
                </div>

                <div className="ct-auth-input-wrap">
                  {renderLockIcon()}
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    autoComplete="new-password"
                    placeholder="Xác nhận mật khẩu"
                    className="ct-auth-input ct-auth-input-has-right"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  {renderEyeToggle(showConfirmPassword, () =>
                    setShowConfirmPassword(!showConfirmPassword)
                  )}
                </div>
              </div>

              <label className="ct-auth-terms-row">
                <input
                  type="checkbox"
                  name="isChecked"
                  checked={agreedTerms}
                  onChange={(e) => setAgreedTerms(e.target.checked)}
                  className="ct-auth-checkbox"
                />
                <span>
                  Đồng ý với{' '}
                  <a
                    href="#terms"
                    onClick={(e) => e.preventDefault()}
                    className="ct-auth-link-inline"
                  >
                    Điều kiện và điều khoản
                  </a>
                </span>
              </label>

              <button
                type="submit"
                disabled={!isRegisterReady}
                className={`ct-auth-submit-btn ${isRegisterReady ? 'ready' : 'disabled'}`}
              >
                Tiếp tục
              </button>

              <div className="ct-auth-switch-row">
                <span>Bạn đã có tài khoản?&nbsp;</span>
                <button
                  type="button"
                  className="ct-auth-link-btn"
                  onClick={() => switchMode('login')}
                >
                  Đăng nhập
                </button>
              </div>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleForgotSubmit} noValidate>
              <h1 className="ct-auth-title">Quên mật khẩu</h1>
              <p className="ct-auth-subtitle">
                Nhập địa chỉ email đã đăng ký để nhận mã xác thực khôi phục mật khẩu.
              </p>

              {errorMsg && <div className="ct-auth-error-banner">{errorMsg}</div>}

              <div className="ct-auth-fields">
                <div className="ct-auth-input-wrap">
                  {renderEnvelopeIcon()}
                  <input
                    type="email"
                    name="email"
                    placeholder="Nhập địa chỉ email"
                    className="ct-auth-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!isForgotReady}
                className={`ct-auth-submit-btn ${isForgotReady ? 'ready' : 'disabled'}`}
                style={{ marginTop: '24px' }}
              >
                Gửi mã
              </button>

              <div className="ct-auth-switch-row">
                <button
                  type="button"
                  className="ct-auth-link-btn"
                  onClick={() => switchMode('login')}
                >
                  Quay lại Đăng nhập
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthView;

