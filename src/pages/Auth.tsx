import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Music, Mail, Lock, User, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useI18n } from '@/i18n/I18nProvider';
import LanguageSelector from '@/components/LanguageSelector';

const Auth: React.FC = () => {
  const { t } = useI18n();

  const [tab, setTab] = useState<'signin' | 'signup' | 'changepw'>('signin');
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [signupError, setSignupError] = useState('');
  const [signupSuccess, setSignupSuccess] = useState('');

  // Change password flow states (email link confirmation)
  const [cpEmail, setCpEmail] = useState('');
  const [cpStage, setCpStage] = useState<'request' | 'reset'>('request');
  const [cpPassword, setCpPassword] = useState('');
  const [cpPassword2, setCpPassword2] = useState('');

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Detect redirect from Supabase password recovery link
  useEffect(() => {
    const type = searchParams.get('type');
    const reset = searchParams.get('reset_password');
    if (type === 'recovery' || reset === '1') {
      setTab('changepw');
      setCpStage('reset');
    }
  }, [searchParams]);

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const displayName = formData.get('displayName') as string;

    setEmailError('');
    setSignupError('');
    setSignupSuccess('');

    if (!validateEmail(email)) {
      setEmailError(t('toasts.invalid_email.desc'));
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      toast.error(t('toasts.password_too_short.title'), {
        description: t('toasts.password_too_short.desc'),
      });
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
        },
      });

      if (error) {
        const errorMessage = error.message.toLowerCase();
        if (
          errorMessage.includes('already registered') ||
          errorMessage.includes('user already registered') ||
          errorMessage.includes('already exists') ||
          errorMessage.includes('duplicate') ||
          errorMessage.includes('taken') ||
          (error as any).status === 422
        ) {
          const errorMsg = t('toasts.account_exists.desc');
          setSignupError(errorMsg);
          toast.error(t('toasts.account_exists.title'), { description: errorMsg });
        } else if (errorMessage.includes('password')) {
          toast.error(t('toasts.password_too_weak.title'), { description: t('toasts.password_too_weak.desc') });
        } else if (errorMessage.includes('email')) {
          toast.error(t('toasts.invalid_email.title'), { description: t('toasts.invalid_email.desc') });
        } else {
          setSignupError(`Error: ${error.message}`);
          toast.error(t('toasts.signup_failed.title'), { description: error.message });
        }
      } else {
        if (data.user && (data.user as any).identities && (data.user as any).identities.length === 0) {
          const errorMsg = t('messages.account_exists_detail');
          setSignupError(errorMsg);
          toast.error(t('toasts.account_exists.title'), { description: errorMsg });
        } else {
          const successMsg = t('messages.check_email_detail');
          setSignupSuccess(successMsg);
          toast.success(t('toasts.account_created.title'), { description: successMsg });
        }
      }
    } catch {
      toast.error(t('toasts.unexpected_error.title'), { description: t('toasts.unexpected_error.desc') });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      await supabase.auth.signOut();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error(t('toasts.invalid_credentials.title'), {
            description: t('toasts.invalid_credentials.desc'),
          });
        } else if (error.message.toLowerCase().includes('not confirmed')) {
          toast.error(t('toasts.email_not_confirmed.title'), {
            description: t('toasts.email_not_confirmed.desc'),
          });
        } else if (error.message.includes('User not found')) {
          toast.error(t('toasts.account_not_found.title'), {
            description: t('toasts.account_not_found.desc'),
          });
        } else {
          toast.error(t('toasts.signin_failed.title'), { description: error.message });
        }
      } else {
        toast.success(t('toasts.welcome_back'));
        navigate('/');
      }
    } catch {
      toast.error(t('toasts.unexpected_error.title'), { description: t('toasts.unexpected_error.desc') });
    } finally {
      setIsLoading(false);
    }
  };

  // Change Password: send confirmation email (recovery link), then allow reset on return
  const handleCpRequest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateEmail(cpEmail)) {
      toast.error(t('toasts.invalid_email.title'), { description: t('toasts.invalid_email.desc') });
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cpEmail, {
        redirectTo: `${window.location.origin}/auth?reset_password=1`,
      });
      if (error) {
        toast.error(t('toasts.reset_failed.title'), { description: error.message });
      } else {
        toast.success(t('toasts.reset_sent.title'), {
          description: t('toasts.reset_sent.desc'),
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCpReset = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (cpPassword.length < 6) {
      toast.error(t('toasts.weak_password.title'), { description: t('toasts.weak_password.desc') });
      return;
    }
    if (cpPassword !== cpPassword2) {
      toast.error(t('toasts.passwords_no_match'));
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: cpPassword });
      if (error) {
        toast.error(t('toasts.update_failed.title'), { description: error.message });
      } else {
        toast.success(t('toasts.update_success'));
        await supabase.auth.signOut();
        setCpStage('request');
        setCpEmail('');
        setCpPassword('');
        setCpPassword2('');
        setTab('signin');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="fixed inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10" />

      <div className="relative z-10 w-full max-w-md">
        <div className="flex items-center justify-center mb-2">
          <LanguageSelector />
        </div>
        <div className="text-center mb-8">
          <img
            src="https://i.ibb.co/4nDnvPR0/1.png"
            alt="AuraSync logo"
            className="w-12 h-12 rounded-full object-cover mx-auto mb-4"
          />
          <h1 className="text-3xl font-bold text-glow mb-2">AuraSync</h1>
          <p className="text-muted-foreground">{t('app.tagline')}</p>
        </div>

        <Card className="glass border-border/50">
          <div className="p-6">
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="signin">{t('tabs.signin')}</TabsTrigger>
                <TabsTrigger value="signup">{t('tabs.signup')}</TabsTrigger>
                <TabsTrigger value="changepw">{t('tabs.changepw')}</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">{t('labels.email')}</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signin-email"
                        name="email"
                        type="email"
                        placeholder={t('placeholders.email')}
                        className="pl-10"
                        required
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signin-password">{t('labels.password')}</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signin-password"
                        name="password"
                        type="password"
                        placeholder="••••••••"
                        className="pl-10"
                        required
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    <Music className="w-4 h-4 mr-2" />
                    {isLoading ? t('buttons.signing_in') : t('buttons.signin')}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                {signupError && (
                  <div className="p-3 mb-4 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-600 dark:text-red-400 font-medium">{t('banners.account_exists.title')}</p>
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">{signupError}</p>
                  </div>
                )}

                {signupSuccess && (
                  <div className="p-3 mb-4 bg-green-100 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <p className="text-sm text-green-600 dark:text-green-400 font-medium">{t('banners.success.title')}</p>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">{signupSuccess}</p>
                  </div>
                )}

                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">{t('labels.display_name')}</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-name"
                        name="displayName"
                        type="text"
                        placeholder={t('placeholders.name')}
                        className="pl-10"
                        required
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email">{t('labels.email')}</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        name="email"
                        type="email"
                        placeholder={t('placeholders.email')}
                        className={`pl-10 ${emailError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                        required
                        disabled={isLoading}
                        onChange={(e) => {
                          const email = e.target.value;
                          if (email && !validateEmail(email)) {
                            setEmailError(t('toasts.invalid_email.desc'));
                          } else {
                            setEmailError('');
                          }
                        }}
                      />
                    </div>
                    {emailError && <p className="text-sm text-red-500">{emailError}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password">{t('labels.password')}</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        name="password"
                        type="password"
                        placeholder="••••••••"
                        className="pl-10"
                        minLength={6}
                        required
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading || !!emailError}>
                    <Music className="w-4 h-4 mr-2" />
                    {isLoading ? t('buttons.creating_account') : t('buttons.create_account')}
                  </Button>

                  <div className="text-xs text-muted-foreground text-center mt-3 p-2 bg-muted/20 rounded">
                    <p>{t('info.email_one_account')}</p>
                    <p>{t('info.confirmation_email')}</p>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="changepw">
                {cpStage === 'request' && (
                  <form onSubmit={handleCpRequest} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="cp-email">{t('labels.email')}</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="cp-email"
                          name="cp-email"
                          type="email"
                          placeholder={t('placeholders.example_email')}
                          className="pl-10"
                          value={cpEmail}
                          onChange={(e) => setCpEmail(e.target.value)}
                          required
                          disabled={isLoading}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">{t('info.reset_email_note')}</p>
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {t('buttons.send_reset_link')}
                    </Button>
                  </form>
                )}

                {cpStage === 'reset' && (
                  <form onSubmit={handleCpReset} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="cp-password">{t('labels.new_password')}</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="cp-password"
                          name="cp-password"
                          type="password"
                          placeholder="••••••••"
                          className="pl-10"
                          value={cpPassword}
                          onChange={(e) => setCpPassword(e.target.value)}
                          minLength={6}
                          required
                          disabled={isLoading}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cp-password2">{t('labels.confirm_new_password')}</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="cp-password2"
                          name="cp-password2"
                          type="password"
                          placeholder="••••••••"
                          className="pl-10"
                          value={cpPassword2}
                          onChange={(e) => setCpPassword2(e.target.value)}
                          minLength={6}
                          required
                          disabled={isLoading}
                        />
                      </div>
                    </div>

                    <Button type="submit" className="w-full" disabled={isLoading}>
                      <RotateCcw className="w-4 h-4 mr-2" />
                      {t('buttons.update_password')}
                    </Button>
                  </form>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          {t('legal.disclaimer')}
        </p>
      </div>
    </div>
  );
};

export default Auth;
