import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type LangCode = 'en' | 'es' | 'fr' | 'de' | 'hi' | 'bn';

type Resources = Record<string, Record<string, string>>;

type I18nContextType = {
  lang: LangCode;
  setLang: (l: LangCode) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  resources: Resources;
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const languageLabels: Record<LangCode, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  hi: 'हिन्दी',
  bn: 'বাংলা',
};

const detectDefaultLang = (): LangCode => {
  const stored = typeof window !== 'undefined' ? (localStorage.getItem('lang') as LangCode | null) : null;
  if (stored && (Object.keys(languageLabels) as LangCode[]).includes(stored)) return stored;
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'en';
  const code = nav.split('-')[0] as LangCode;
  if ((Object.keys(languageLabels) as LangCode[]).includes(code)) return code;
  return 'en';
};

const interpolate = (str: string, vars?: Record<string, string | number>) => {
  if (!vars) return str;
  return str.replace(/\{(.*?)\}/g, (_, k) => (vars[k] ?? `{${k}}`).toString());
};

const resources: Resources = {
  en: {
    'app.tagline': 'Connect your emotions to music',
    'legal.disclaimer': 'By continuing, you agree to our Terms of Service and Privacy Policy',

    'tabs.signin': 'Sign In',
    'tabs.signup': 'Sign Up',
    'tabs.changepw': 'Change Password',

    'labels.email': 'Email',
    'labels.password': 'Password',
    'labels.display_name': 'Display Name',
    'labels.new_password': 'New Password',
    'labels.confirm_new_password': 'Confirm New Password',

    'placeholders.email': 'your@email.com',
    'placeholders.example_email': 'you@example.com',
    'placeholders.name': 'Your Name',

    'buttons.signin': 'Sign In',
    'buttons.signing_in': 'Signing in...',
    'buttons.create_account': 'Create Account',
    'buttons.creating_account': 'Creating account...',
    'buttons.send_reset_link': 'Send Reset Link',
    'buttons.update_password': 'Update Password',

    'info.email_one_account': 'Each email address can only be used for one account.',
    'info.confirmation_email': "You'll receive a confirmation email to activate your account.",
    'info.reset_email_note': "We'll email you a secure link to confirm your identity.",

    'toasts.invalid_credentials.title': 'Invalid credentials',
    'toasts.invalid_credentials.desc': "Please check your email and password. If you just signed up, make sure you've confirmed your email address.",
    'toasts.email_not_confirmed.title': 'Email not confirmed',
    'toasts.email_not_confirmed.desc': 'Please check your email and click the confirmation link before signing in.',
    'toasts.account_not_found.title': 'Account not found',
    'toasts.account_not_found.desc': 'No account found with this email address. Please sign up first.',
    'toasts.signin_failed.title': 'Sign in failed',
    'toasts.signup_failed.title': 'Sign up failed',
    'toasts.welcome_back': 'Welcome back!',
    'toasts.password_too_short.title': 'Password too short',
    'toasts.password_too_short.desc': 'Password must be at least 6 characters long.',
    'toasts.password_too_weak.title': 'Password too weak',
    'toasts.password_too_weak.desc': 'Use at least 6 characters.',
    'toasts.invalid_email.title': 'Invalid email',
    'toasts.invalid_email.desc': 'Please enter a valid email address.',
    'toasts.unexpected_error.title': 'An unexpected error occurred',
    'toasts.unexpected_error.desc': 'Please try again later.',
    'toasts.account_exists.title': 'Account Already Exists',
    'toasts.account_exists.desc': 'An account with this email already exists. Please sign in instead.',
    'toasts.account_created.title': 'Account created!',
    'toasts.account_created.desc': 'Please check your email and click the confirmation link to activate your account.',
    'toasts.reset_failed.title': 'Failed to send reset email',
    'toasts.reset_sent.title': 'Password reset email sent',
    'toasts.reset_sent.desc': 'Check your inbox and follow the confirmation link.',
    'toasts.weak_password.title': 'Weak password',
    'toasts.weak_password.desc': 'Use at least 6 characters.',
    'toasts.passwords_no_match': "Passwords don't match",
    'toasts.update_failed.title': 'Failed to update password',
    'toasts.update_success': 'Password changed successfully',

    'banners.account_exists.title': 'Account Already Exists',
    'banners.success.title': 'Success',

    'messages.account_exists_detail': 'An account with this email address already exists. Please sign in instead.',
    'messages.check_email_detail': 'Please check your email and click the confirmation link to activate your account.',
  },
  es: {
    'app.tagline': 'Conecta tus emociones con la música',
    'legal.disclaimer': 'Al continuar, aceptas nuestros Términos de servicio y Política de privacidad',

    'tabs.signin': 'Iniciar sesión',
    'tabs.signup': 'Registrarse',
    'tabs.changepw': 'Cambiar contraseña',

    'labels.email': 'Correo electrónico',
    'labels.password': 'Contraseña',
    'labels.display_name': 'Nombre para mostrar',
    'labels.new_password': 'Nueva contraseña',
    'labels.confirm_new_password': 'Confirmar nueva contraseña',

    'placeholders.email': 'tu@email.com',
    'placeholders.example_email': 'tu@ejemplo.com',
    'placeholders.name': 'Tu nombre',

    'buttons.signin': 'Iniciar sesión',
    'buttons.signing_in': 'Iniciando sesión...',
    'buttons.create_account': 'Crear cuenta',
    'buttons.creating_account': 'Creando cuenta...',
    'buttons.send_reset_link': 'Enviar enlace de restablecimiento',
    'buttons.update_password': 'Actualizar contraseña',

    'info.email_one_account': 'Cada correo electrónico solo puede usarse para una cuenta.',
    'info.confirmation_email': 'Recibirás un correo para activar tu cuenta.',
    'info.reset_email_note': 'Te enviaremos un enlace seguro para confirmar tu identidad.',

    'toasts.invalid_credentials.title': 'Credenciales inválidas',
    'toasts.invalid_credentials.desc': 'Verifica tu correo y contraseña. Si acabas de registrarte, confirma tu correo.',
    'toasts.email_not_confirmed.title': 'Correo no confirmado',
    'toasts.email_not_confirmed.desc': 'Revisa tu correo y haz clic en el enlace de confirmación.',
    'toasts.account_not_found.title': 'Cuenta no encontrada',
    'toasts.account_not_found.desc': 'No existe una cuenta con este correo. Regístrate primero.',
    'toasts.signin_failed.title': 'Fallo al iniciar sesión',
    'toasts.signup_failed.title': 'Fallo al registrarse',
    'toasts.welcome_back': '¡Bienvenido de nuevo!',
    'toasts.password_too_short.title': 'Contraseña demasiado corta',
    'toasts.password_too_short.desc': 'Debe tener al menos 6 caracteres.',
    'toasts.password_too_weak.title': 'Contraseña débil',
    'toasts.password_too_weak.desc': 'Usa al menos 6 caracteres.',
    'toasts.invalid_email.title': 'Correo inválido',
    'toasts.invalid_email.desc': 'Ingresa un correo válido.',
    'toasts.unexpected_error.title': 'Ocurrió un error inesperado',
    'toasts.unexpected_error.desc': 'Inténtalo de nuevo más tarde.',
    'toasts.account_exists.title': 'La cuenta ya existe',
    'toasts.account_exists.desc': 'Ya existe una cuenta con este correo. Inicia sesión.',
    'toasts.account_created.title': '¡Cuenta creada!',
    'toasts.account_created.desc': 'Revisa tu correo y confirma para activar la cuenta.',
    'toasts.reset_failed.title': 'No se pudo enviar el correo de restablecimiento',
    'toasts.reset_sent.title': 'Correo de restablecimiento enviado',
    'toasts.reset_sent.desc': 'Revisa tu bandeja de entrada y sigue el enlace.',
    'toasts.weak_password.title': 'Contraseña débil',
    'toasts.weak_password.desc': 'Usa al menos 6 caracteres.',
    'toasts.passwords_no_match': 'Las contraseñas no coinciden',
    'toasts.update_failed.title': 'No se pudo actualizar la contraseña',
    'toasts.update_success': 'Contraseña cambiada con éxito',

    'banners.account_exists.title': 'La cuenta ya existe',
    'banners.success.title': 'Éxito',

    'messages.account_exists_detail': 'Ya existe una cuenta con este correo. Inicia sesión.',
    'messages.check_email_detail': 'Revisa tu correo y confirma para activar tu cuenta.',
  },
  fr: {
    'app.tagline': 'Reliez vos émotions à la musique',
    'legal.disclaimer': 'En continuant, vous acceptez nos Conditions d’utilisation et notre Politique de confidentialité',

    'tabs.signin': 'Se connecter',
    'tabs.signup': "S'inscrire",
    'tabs.changepw': 'Changer le mot de passe',

    'labels.email': 'E-mail',
    'labels.password': 'Mot de passe',
    'labels.display_name': 'Nom affiché',
    'labels.new_password': 'Nouveau mot de passe',
    'labels.confirm_new_password': 'Confirmez le nouveau mot de passe',

    'placeholders.email': 'votre@email.com',
    'placeholders.example_email': 'vous@exemple.com',
    'placeholders.name': 'Votre nom',

    'buttons.signin': 'Se connecter',
    'buttons.signing_in': 'Connexion...',
    'buttons.create_account': 'Créer un compte',
    'buttons.creating_account': 'Création du compte...',
    'buttons.send_reset_link': 'Envoyer le lien de réinitialisation',
    'buttons.update_password': 'Mettre à jour le mot de passe',

    'info.email_one_account': 'Chaque adresse e-mail ne peut être utilisée que pour un seul compte.',
    'info.confirmation_email': 'Vous recevrez un e-mail de confirmation pour activer votre compte.',
    'info.reset_email_note': 'Nous vous enverrons un lien sécurisé pour confirmer votre identité.',

    'toasts.invalid_credentials.title': 'Identifiants invalides',
    'toasts.invalid_credentials.desc': 'Vérifiez votre e-mail et votre mot de passe. Si vous venez de vous inscrire, confirmez votre e-mail.',
    'toasts.email_not_confirmed.title': 'E-mail non confirmé',
    'toasts.email_not_confirmed.desc': 'Vérifiez votre e-mail et cliquez sur le lien de confirmation.',
    'toasts.account_not_found.title': 'Compte introuvable',
    'toasts.account_not_found.desc': "Aucun compte trouvé avec cet e-mail. Veuillez d'abord vous inscrire.",
    'toasts.signin_failed.title': 'Échec de la connexion',
    'toasts.signup_failed.title': "Échec de l'inscription",
    'toasts.welcome_back': 'Content de vous revoir !',
    'toasts.password_too_short.title': 'Mot de passe trop court',
    'toasts.password_too_short.desc': 'Au moins 6 caractères.',
    'toasts.password_too_weak.title': 'Mot de passe faible',
    'toasts.password_too_weak.desc': 'Utilisez au moins 6 caractères.',
    'toasts.invalid_email.title': 'E-mail invalide',
    'toasts.invalid_email.desc': 'Veuillez saisir une adresse e-mail valide.',
    'toasts.unexpected_error.title': 'Une erreur inattendue est survenue',
    'toasts.unexpected_error.desc': 'Veuillez réessayer plus tard.',
    'toasts.account_exists.title': 'Le compte existe déjà',
    'toasts.account_exists.desc': 'Un compte avec cet e-mail existe déjà. Connectez-vous.',
    'toasts.account_created.title': 'Compte créé !',
    'toasts.account_created.desc': 'Vérifiez votre e-mail et cliquez sur le lien de confirmation.',
    'toasts.reset_failed.title': "Échec de l'envoi de l'e-mail de réinitialisation",
    'toasts.reset_sent.title': 'E-mail de réinitialisation envoyé',
    'toasts.reset_sent.desc': 'Consultez votre boîte de réception et suivez le lien.',
    'toasts.weak_password.title': 'Mot de passe faible',
    'toasts.weak_password.desc': 'Utilisez au moins 6 caractères.',
    'toasts.passwords_no_match': 'Les mots de passe ne correspondent pas',
    'toasts.update_failed.title': 'Échec de la mise à jour du mot de passe',
    'toasts.update_success': 'Mot de passe modifié avec succès',

    'banners.account_exists.title': 'Le compte existe déjà',
    'banners.success.title': 'Succès',

    'messages.account_exists_detail': 'Un compte avec cette adresse e-mail existe déjà. Connectez-vous.',
    'messages.check_email_detail': 'Vérifiez votre e-mail et cliquez sur le lien de confirmation pour activer votre compte.',
  },
  de: {
    'app.tagline': 'Verbinde deine Emotionen mit Musik',
    'legal.disclaimer': 'Mit dem Fortfahren stimmst du unseren Nutzungsbedingungen und der Datenschutzrichtlinie zu',

    'tabs.signin': 'Anmelden',
    'tabs.signup': 'Registrieren',
    'tabs.changepw': 'Passwort ändern',

    'labels.email': 'E-Mail',
    'labels.password': 'Passwort',
    'labels.display_name': 'Anzeigename',
    'labels.new_password': 'Neues Passwort',
    'labels.confirm_new_password': 'Neues Passwort bestätigen',

    'placeholders.email': 'deine@email.com',
    'placeholders.example_email': 'du@beispiel.de',
    'placeholders.name': 'Dein Name',

    'buttons.signin': 'Anmelden',
    'buttons.signing_in': 'Anmeldung...',
    'buttons.create_account': 'Konto erstellen',
    'buttons.creating_account': 'Konto wird erstellt...',
    'buttons.send_reset_link': 'Link zum Zurücksetzen senden',
    'buttons.update_password': 'Passwort aktualisieren',

    'info.email_one_account': 'Jede E-Mail-Adresse kann nur für ein Konto verwendet werden.',
    'info.confirmation_email': 'Du erhältst eine Bestätigungs-E-Mail zur Aktivierung deines Kontos.',
    'info.reset_email_note': 'Wir senden dir einen sicheren Link zur Bestätigung deiner Identität.',

    'toasts.invalid_credentials.title': 'Ungültige Anmeldedaten',
    'toasts.invalid_credentials.desc': 'Bitte E-Mail und Passwort prüfen. Wenn du dich gerade registriert hast, bestätige deine E-Mail.',
    'toasts.email_not_confirmed.title': 'E-Mail nicht bestätigt',
    'toasts.email_not_confirmed.desc': 'Bitte E-Mail prüfen und den Bestätigungslink anklicken.',
    'toasts.account_not_found.title': 'Konto nicht gefunden',
    'toasts.account_not_found.desc': 'Kein Konto mit dieser E-Mail gefunden. Bitte zuerst registrieren.',
    'toasts.signin_failed.title': 'Anmeldung fehlgeschlagen',
    'toasts.signup_failed.title': 'Registrierung fehlgeschlagen',
    'toasts.welcome_back': 'Willkommen zurück!',
    'toasts.password_too_short.title': 'Passwort zu kurz',
    'toasts.password_too_short.desc': 'Mindestens 6 Zeichen.',
    'toasts.password_too_weak.title': 'Schwaches Passwort',
    'toasts.password_too_weak.desc': 'Mindestens 6 Zeichen verwenden.',
    'toasts.invalid_email.title': 'Ungültige E-Mail',
    'toasts.invalid_email.desc': 'Bitte eine gültige E-Mail-Adresse eingeben.',
    'toasts.unexpected_error.title': 'Unerwarteter Fehler',
    'toasts.unexpected_error.desc': 'Bitte später erneut versuchen.',
    'toasts.account_exists.title': 'Konto existiert bereits',
    'toasts.account_exists.desc': 'Mit dieser E-Mail existiert bereits ein Konto. Bitte anmelden.',
    'toasts.account_created.title': 'Konto erstellt!',
    'toasts.account_created.desc': 'Bitte E-Mail prüfen und Bestätigungslink anklicken.',
    'toasts.reset_failed.title': 'Zurücksetz-E-Mail konnte nicht gesendet werden',
    'toasts.reset_sent.title': 'Zurücksetz-E-Mail gesendet',
    'toasts.reset_sent.desc': 'Posteingang prüfen und dem Link folgen.',
    'toasts.weak_password.title': 'Schwaches Passwort',
    'toasts.weak_password.desc': 'Mindestens 6 Zeichen verwenden.',
    'toasts.passwords_no_match': 'Passwörter stimmen nicht überein',
    'toasts.update_failed.title': 'Passwortaktualisierung fehlgeschlagen',
    'toasts.update_success': 'Passwort erfolgreich geändert',

    'banners.account_exists.title': 'Konto existiert bereits',
    'banners.success.title': 'Erfolg',

    'messages.account_exists_detail': 'Mit dieser E-Mail existiert bereits ein Konto. Bitte anmelden.',
    'messages.check_email_detail': 'Bitte E-Mail prüfen und Bestätigungslink anklicken, um das Konto zu aktivieren.',
  },
  hi: {
    'app.tagline': 'अपनी भावनाओं को संगीत से जोड़ें',
    'legal.disclaimer': 'जारी रखते हुए, आप हमारी सेवा की शर्तों और गोपनीयता नीति से सहमत हैं',

    'tabs.signin': 'साइन इन',
    'tabs.signup': 'साइन अप',
    'tabs.changepw': 'पासवर्ड बदलें',

    'labels.email': 'ईमेल',
    'labels.password': 'पासवर्ड',
    'labels.display_name': 'प्रदर्शित नाम',
    'labels.new_password': 'नया पासवर्ड',
    'labels.confirm_new_password': 'नया पासवर्ड पुष्टि करें',

    'placeholders.email': 'aapka@email.com',
    'placeholders.example_email': 'aap@udaharan.com',
    'placeholders.name': 'आपका नाम',

    'buttons.signin': 'साइन इन',
    'buttons.signing_in': 'साइन इन हो रहा है...',
    'buttons.create_account': 'खाता बनाएँ',
    'buttons.creating_account': 'खाता बनाया जा रहा है...',
    'buttons.send_reset_link': 'रीसेट लिंक भेजें',
    'buttons.update_password': 'पासवर्ड अपडेट करें',

    'info.email_one_account': 'प्रत्येक ईमेल केवल एक खाते के लिए उपयोग किया जा सकता है।',
    'info.confirmation_email': 'आपको अपना खाता सक्रिय करने के लिए पुष्टि ईमेल मिलेगा।',
    'info.reset_email_note': 'हम आपकी पहचान की पुष्टि के लिए एक सुरक्षित लिंक ईमेल करेंगे।',

    'toasts.invalid_credentials.title': 'अमान्य क्रेडेंशियल',
    'toasts.invalid_credentials.desc': 'कृपया ईमेल और पासवर्ड जाँचें। यदि आपने अभी साइन अप किया है, तो अपना ईमेल पुष्ट करें।',
    'toasts.email_not_confirmed.title': 'ईमेल पुष्टि नहीं हुआ',
    'toasts.email_not_confirmed.desc': 'कृपया ईमेल देखें और पुष्टि लिंक पर क्लिक करें।',
    'toasts.account_not_found.title': 'खाता नहीं मिला',
    'toasts.account_not_found.desc': 'इस ईमेल के साथ कोई खाता नहीं मिला। पहले साइन अप करें।',
    'toasts.signin_failed.title': 'साइन इन विफल',
    'toasts.signup_failed.title': 'साइन अप विफल',
    'toasts.welcome_back': 'वापसी पर स्वागत है!',
    'toasts.password_too_short.title': 'पासवर्ड बहुत छोटा है',
    'toasts.password_too_short.desc': 'कम से कम 6 अक्षर होने चाहिए।',
    'toasts.password_too_weak.title': 'कमज़ोर पासवर्ड',
    'toasts.password_too_weak.desc': 'कम से कम 6 अक्षर उपयोग करें।',
    'toasts.invalid_email.title': 'अमान्य ईमेल',
    'toasts.invalid_email.desc': 'कृपया वैध ईमेल दर्ज करें।',
    'toasts.unexpected_error.title': 'एक अनपेक्षित त्रुटि हुई',
    'toasts.unexpected_error.desc': 'कृपया बाद में पुनः प्रयास करें।',
    'toasts.account_exists.title': 'खाता पहले से मौजूद है',
    'toasts.account_exists.desc': 'इस ईमेल के साथ खाता पहले से मौजूद है। कृपया साइन इन करें।',
    'toasts.account_created.title': 'खाता बन गया!',
    'toasts.account_created.desc': 'कृपया अपना ईमेल देखें और पुष्टि लिंक पर क्लिक करें।',
    'toasts.reset_failed.title': 'रीसेट ईमेल भेजने में विफल',
    'toasts.reset_sent.title': 'पासवर्ड रीसेट ईमेल भेजा गया',
    'toasts.reset_sent.desc': 'अपना इनबॉक्स जाँचें और लिंक का पालन करें।',
    'toasts.weak_password.title': 'कमज़ोर पासवर्ड',
    'toasts.weak_password.desc': 'कम से कम 6 अक्षर उपयोग करें।',
    'toasts.passwords_no_match': 'पासवर्ड मेल नहीं खाते',
    'toasts.update_failed.title': 'पासवर्ड अपडेट विफल',
    'toasts.update_success': 'पासवर्ड सफलतापूर्वक बदला गया',

    'banners.account_exists.title': 'खाता पहले से मौजूद है',
    'banners.success.title': 'सफलता',

    'messages.account_exists_detail': 'इस ईमेल के साथ खाता पहले से मौजूद है। कृपया साइन इन करें।',
    'messages.check_email_detail': 'कृपया अपना ईमेल देखें और पुष्टि लिंक पर क्लिक करें।',
  },
  bn: {
    'app.tagline': 'আপনার অনুভূতিগুলোকে সংগীতের সাথে যুক্ত করুন',
    'legal.disclaimer': 'চালিয়ে গেলে আপনি আমাদের পরিষেবার শর্তাবলী ও গোপনীয়তা নীত���তে সম্মত হচ্ছেন',

    'tabs.signin': 'সাইন ইন',
    'tabs.signup': 'সাইন আপ',
    'tabs.changepw': 'পাসওয়ার্ড পরিবর্তন',

    'labels.email': 'ইমেইল',
    'labels.password': 'পাসওয়ার্ড',
    'labels.display_name': 'প্রদর্শিত নাম',
    'labels.new_password': 'নতুন পাসওয়ার্ড',
    'labels.confirm_new_password': 'নতুন পাসওয়ার্ড নিশ্চিত করুন',

    'placeholders.email': 'apnar@email.com',
    'placeholders.example_email': 'apni@udaharun.com',
    'placeholders.name': 'আপনার নাম',

    'buttons.signin': 'সাইন ইন',
    'buttons.signing_in': 'সাইন ইন হচ্ছে...',
    'buttons.create_account': 'অ্যাকাউন্ট তৈরি করুন',
    'buttons.creating_account': 'অ্যাকাউন্ট তৈরি হচ্ছে...',
    'buttons.send_reset_link': 'রিসেট লিংক পাঠান',
    'buttons.update_password': 'পাসওয়ার্ড আপডেট করুন',

    'info.email_one_account': 'প্রতিটি ইমেইল কেবল একটি অ্যাকাউন্টের জন্য ব্যবহার করা যাবে।',
    'info.confirmation_email': 'আপনি আপনার অ্যাকাউন্ট সক্রিয় করতে একটি নিশ্চিতকরণ ইমেইল পাবেন।',
    'info.reset_email_note': 'আমরা আপনার পরিচয় নিশ্চিত করতে একটি সুরক্ষিত লিংক ইমেইল করব।',

    'toasts.invalid_credentials.title': 'অবৈধ শংসাপত্র',
    'toasts.invalid_credentials.desc': 'ইমেইল ও পাসওয়ার্ড যাচাই করুন। সদ্য সাইন আপ করলে ইমেইল নিশ্চিত করুন।',
    'toasts.email_not_confirmed.title': 'ইমেইল নিশ্চিত করা হয়নি',
    'toasts.email_not_confirmed.desc': 'ইমেইল দেখুন এবং নিশ্চিতকরণ লিংকে ক্লিক করুন।',
    'toasts.account_not_found.title': 'অ্যাকাউন্ট পাওয়া যায়নি',
    'toasts.account_not_found.desc': 'এই ইমেইল দিয়ে কোনো অ্যাকাউন্ট নেই। আগে সাইন আপ করুন���',
    'toasts.signin_failed.title': 'সাইন ইন ব্যর্থ',
    'toasts.signup_failed.title': 'সাইন আপ ব্যর্থ',
    'toasts.welcome_back': 'পুনরায় স্বাগতম!',
    'toasts.password_too_short.title': 'পাসওয়ার্ড খুব ছোট',
    'toasts.password_too_short.desc': 'কমপক্ষে ৬ অক্ষর হওয়া উচিত।',
    'toasts.password_too_weak.title': 'দুর্বল পাসওয়ার্ড',
    'toasts.password_too_weak.desc': 'কমপক্ষে ৬ অক্ষর ব্যবহার করুন।',
    'toasts.invalid_email.title': 'অবৈধ ইমেইল',
    'toasts.invalid_email.desc': 'একটি বৈধ ইমেইল দিন।',
    'toasts.unexpected_error.title': 'অপ্রত্যাশিত ত্রুটি ঘটেছে',
    'toasts.unexpected_error.desc': 'পরে আবার চেষ্টা করুন।',
    'toasts.account_exists.title': 'অ্যাকাউন্ট ইতিমধ্যে আছে',
    'toasts.account_exists.desc': 'এই ইমেইল দিয়ে একটি অ্যাকাউন্ট ইতিমধ্যে আছে। দয়া করে সাইন ইন করুন।',
    'toasts.account_created.title': 'অ্যাকাউন্ট তৈরি হয়েছে!',
    'toasts.account_created.desc': 'ইমেইল দেখুন এবং নিশ্চিতকরণ লিংকে ক্লিক করুন।',
    'toasts.reset_failed.title': 'রিসেট ইমেইল পাঠানো যায়নি',
    'toasts.reset_sent.title': 'পাসওয়ার্ড রিসেট ইমেইল পাঠানো হয়েছে',
    'toasts.reset_sent.desc': 'ইনবক্স দেখুন এবং লিংক অনুসরণ করুন।',
    'toasts.weak_password.title': 'দুর্বল পাসওয়ার্ড',
    'toasts.weak_password.desc': 'কমপক্ষে ৬ অক্ষর ব্যবহার করুন।',
    'toasts.passwords_no_match': 'পাসওয়ার্ড মেলে না',
    'toasts.update_failed.title': 'পাসওয়ার্ড আপডেট ব্যর্থ',
    'toasts.update_success': 'পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে',

    'banners.account_exists.title': 'অ্যাকাউন্ট ইতিমধ্যে আছে',
    'banners.success.title': 'সফল',

    'messages.account_exists_detail': 'এই ইমেইল দিয়ে একটি অ্যাকাউন্ট ইতিমধ্যে আছে। দয়া করে সাইন ইন করুন।',
    'messages.check_email_detail': 'ইমেইল দেখুন এবং নিশ্চিতকরণ লিংকে ক্লিক করুন।',
  },
};

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<LangCode>(detectDefaultLang());

  useEffect(() => {
    try {
      localStorage.setItem('lang', lang);
    } catch {}
  }, [lang]);

  const setLang = useCallback((l: LangCode) => {
    setLangState(l);
  }, []);

  const t = useCallback((key: string, vars?: Record<string, string | number>) => {
    const dict = resources[lang] || resources.en;
    const val = dict[key] ?? resources.en[key] ?? key;
    return interpolate(val, vars);
  }, [lang]);

  const value = useMemo<I18nContextType>(() => ({ lang, setLang, t, resources }), [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
};
