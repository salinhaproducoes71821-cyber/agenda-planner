import React from 'react';
import {useTheme} from './theme';
import {SECURITY, a11y} from './constants';
import {Icon, Input, PasswordStrengthBar, Ornament} from './ui';
import {useAuth} from './auth-context';
import {useState, useRef, useEffect} from 'react';
import {View, TouchableOpacity, Text, ActivityIndicator, StatusBar, KeyboardAvoidingView, Platform, ScrollView, Image} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

function ForgotPasswordForm({ onBack }) {
  const { C, T } = useTheme();
  const { requestPasswordReset, confirmPasswordReset } = useAuth();

  const [step,        setStep]        = useState('request'); // 'request' | 'verify'
  const [email,       setEmail]       = useState('');
  const [code,        setCode]        = useState('');
  const [senha,       setSenha]       = useState('');
  const [confirma,    setConfirma]    = useState('');
  const [showPwd,     setShowPwd]     = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [erro,        setErro]        = useState('');
  const [info,        setInfo]        = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const sendCode = async () => {
    setErro(''); setFieldErrors({});
    if (!SECURITY.emailRegex.test(email)) { setFieldErrors({ email: 'E-mail inválido' }); return; }
    setLoading(true);
    try {
      await requestPasswordReset(email.trim().toLowerCase());
      setInfo('Se existir uma conta com esse e-mail, enviamos um código de verificação. Confira a caixa de entrada e o spam.');
      setStep('verify');
    } catch (e) {
      setErro(e.message || 'Não foi possível enviar o código.');
    } finally { setLoading(false); }
  };

  const doReset = async () => {
    setErro(''); setFieldErrors({});
    const erros = {};
    if (!/^\d{6,10}$/.test(code.trim())) erros.code = 'Informe o código recebido por e-mail';
    const pwdErros = SECURITY.validatePassword(senha);
    if (pwdErros.length > 0)          erros.senha = pwdErros[0];
    if (senha !== confirma)           erros.confirma = 'As senhas não coincidem';
    setFieldErrors(erros);
    if (Object.keys(erros).length) return;
    setLoading(true);
    try {
      await confirmPasswordReset(email.trim().toLowerCase(), code.trim(), senha);
      // Sucesso: confirmPasswordReset já carrega o perfil → o app navega sozinho.
    } catch (e) {
      setErro(e.message || 'Código inválido ou expirado.');
    } finally { setLoading(false); }
  };

  return (
    <View style={{ backgroundColor:C.bg2, borderRadius:16, borderWidth:1, borderColor:C.border2, overflow:'hidden' }}>
      <View style={{ flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal:16, paddingVertical:12, borderBottomWidth:1, borderBottomColor:C.border }}>
        <TouchableOpacity onPress={onBack} style={{ minWidth:40, minHeight:40, alignItems:'center', justifyContent:'center' }} {...a11y('Voltar para o login')}>
          <Icon name="back" size={20} color={C.text2}/>
        </TouchableOpacity>
        <Text style={[T.sm, { fontWeight:'700', letterSpacing:1.2, color:C.text }]}>RECUPERAR SENHA</Text>
      </View>

      <View style={{ padding:24, gap:16 }}>
        {step === 'request' ? (
          <>
            <Text style={[T.sm, { color:C.text2, lineHeight:20 }]}>
              Informe o e-mail da sua conta. Enviaremos um código de verificação para você criar uma nova senha.
            </Text>
            <Input
              label="E-MAIL"
              value={email}
              onChangeText={setEmail}
              placeholder="seu@email.com"
              keyboardType="email-address"
              error={fieldErrors.email}
            />
          </>
        ) : (
          <>
            <Text style={[T.sm, { color:C.text2, lineHeight:20 }]}>
              Digite o código enviado para{' '}
              <Text style={{ color:C.text, fontWeight:'700' }}>{email.trim().toLowerCase()}</Text>
              {' '}e escolha uma nova senha.
            </Text>
            <Input
              label="CÓDIGO DO E-MAIL"
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 10))}
              placeholder="Código recebido por e-mail"
              keyboardType="number-pad"
              error={fieldErrors.code}
            />
            <Input
              label="NOVA SENHA"
              value={senha}
              onChangeText={setSenha}
              placeholder="••••••••"
              secureTextEntry={!showPwd}
              error={fieldErrors.senha}
              hint="Mínimo 8 caracteres com maiúscula, número e símbolo"
              right={
                <TouchableOpacity onPress={() => setShowPwd(v => !v)} style={{ padding:4, minWidth:32, minHeight:32, alignItems:'center', justifyContent:'center' }} {...a11y(showPwd ? 'Ocultar senha' : 'Mostrar senha')}>
                  <Icon name={showPwd ? 'eyeOff' : 'eye'} size={18} color={C.text3}/>
                </TouchableOpacity>
              }
            />
            <PasswordStrengthBar password={senha}/>
            <Input
              label="CONFIRMAR NOVA SENHA"
              value={confirma}
              onChangeText={setConfirma}
              placeholder="••••••••"
              secureTextEntry={!showPwd}
              error={fieldErrors.confirma}
            />
          </>
        )}

        {!!info && (
          <View style={{ backgroundColor:C.accentBg, borderWidth:1, borderColor:C.accent + '40', borderRadius:8, padding:12, flexDirection:'row', alignItems:'flex-start', gap:8 }}>
            <Icon name="mail" size={16} color={C.accent}/>
            <Text style={[T.sm, { flex:1, color:C.text2, lineHeight:20 }]}>{info}</Text>
          </View>
        )}

        {!!erro && (
          <View style={{ backgroundColor:C.danger + '18', borderWidth:1, borderColor:C.danger + '40', borderRadius:8, padding:12, flexDirection:'row', alignItems:'flex-start', gap:8 }}>
            <Icon name="error" size={16} color={C.danger}/>
            <Text style={[T.sm, { flex:1, color:C.danger, lineHeight:20 }]}>{erro}</Text>
          </View>
        )}

        <TouchableOpacity
          style={{ backgroundColor:C.accent, borderRadius:10, minHeight:52, alignItems:'center', justifyContent:'center', marginTop:4, opacity: loading ? 0.7 : 1 }}
          onPress={step === 'request' ? sendCode : doReset}
          disabled={loading}
          {...a11y(step === 'request' ? 'Enviar código' : 'Redefinir senha')}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small"/>
            : <Text style={[T.base, { color:'#fff', fontWeight:'700', letterSpacing:1.2 }]}>
                {step === 'request' ? 'ENVIAR CÓDIGO' : 'REDEFINIR SENHA'}
              </Text>}
        </TouchableOpacity>

        {step === 'verify' && (
          <TouchableOpacity
            onPress={() => { setStep('request'); setCode(''); setSenha(''); setConfirma(''); setErro(''); setInfo(''); setFieldErrors({}); }}
            style={{ alignItems:'center', minHeight:44, justifyContent:'center' }}
            {...a11y('Reenviar código')}
          >
            <Text style={[T.sm, { color:C.accent, fontWeight:'700' }]}>Não recebeu? Enviar de novo</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function AuthScreen() {
  const { C, T } = useTheme();
  const { login, register } = useAuth();

  const [mode,        setMode]        = useState('login');
  const [name,        setName]        = useState('');
  const [email,       setEmail]       = useState('');
  const [senha,       setSenha]       = useState('');
  const [confirma,    setConfirma]    = useState('');
  const [showPwd,     setShowPwd]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [erro,        setErro]        = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [attempts,    setAttempts]    = useState(0);
  const [blocked,     setBlocked]     = useState(false);
  const blockTimer = useRef(null);

  const switchMode = (m) => {
    setMode(m); setErro(''); setName(''); setEmail('');
    setSenha(''); setConfirma(''); setFieldErrors({});
    setShowPwd(false); setShowConfirm(false);
  };

  const validateFields = () => {
    const erros = {};
    if (mode === 'register' && name.trim().length < 2) erros.name = 'Nome muito curto';
    if (!SECURITY.emailRegex.test(email))              erros.email = 'E-mail inválido';
    if (mode === 'login' && senha.length < 1)          erros.senha = 'Informe a senha';
    if (mode === 'register') {
      const pwdErros = SECURITY.validatePassword(senha);
      if (pwdErros.length > 0) erros.senha = pwdErros[0];
      if (senha !== confirma)  erros.confirma = 'As senhas não coincidem';
    }
    setFieldErrors(erros);
    return Object.keys(erros).length === 0;
  };

  const submit = async () => {
    if (blocked) { setErro('Aguarde antes de tentar novamente.'); return; }
    if (!validateFields()) return;

    setErro(''); setLoading(true);
    try {
      if (mode === 'login') {
        await login(email.trim().toLowerCase(), senha);
        setAttempts(0);
      } else {
        await register(name.trim(), email.trim().toLowerCase(), senha, confirma);
      }
    } catch (e) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setErro(e.message || 'Erro ao autenticar');
      if (newAttempts >= 5) {
        setBlocked(true);
        setErro('Muitas tentativas. Aguarde 30 segundos.');
        blockTimer.current = setTimeout(() => { setBlocked(false); setAttempts(0); }, 30000);
      }
    } finally {
      setLoading(false);
    }
  };

  // CORREÇÃO: cleanup do timer no unmount
  useEffect(() => () => clearTimeout(blockTimer.current), []);

  return (
    <SafeAreaView edges={['top','bottom']} style={{ flex:1, backgroundColor:C.bg }}>
      <StatusBar
        barStyle={C.bg === '#f5f0e8' || C.bg === '#f0f4f8' ? 'dark-content' : 'light-content'}
        backgroundColor={C.bg}
      />
      <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={{ flexGrow:1, justifyContent:'center', padding:28 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Brand */}
          <View style={{ alignItems:'center', marginBottom:40 }}>
            <Image
              source={require('./LogoNovaCorEnovosHighlightsNovo.png')}
              style={{ width:96, height:96, borderRadius:20, marginBottom:16 }}
              resizeMode="contain"
            />
            <Text style={[T.h1, { color:C.text, letterSpacing:2 }]}>AGENDA</Text>
            <Ornament style={{ width:200, marginTop:12 }}/>
            <Text style={[T.caption, { color:C.text3, marginTop:8, letterSpacing:3 }]}>
              SEU TEMPO, ORGANIZADO
            </Text>
          </View>

          {/* Card */}
          {mode === 'forgot' ? (
            <ForgotPasswordForm onBack={() => switchMode('login')} />
          ) : (
          <View style={{
            backgroundColor:C.bg2, borderRadius:16,
            borderWidth:1, borderColor:C.border2, overflow:'hidden',
          }}>
            {/* Tabs */}
            <View style={{ flexDirection:'row', borderBottomWidth:1, borderBottomColor:C.border }} accessibilityRole="tablist">
              {[
                { m:'login',    label:'ENTRAR'    },
                { m:'register', label:'CADASTRAR' },
              ].map(({ m, label }) => (
                <TouchableOpacity key={m}
                  style={{
                    flex:1, minHeight:52, alignItems:'center', justifyContent:'center',
                    borderBottomWidth:2.5,
                    borderBottomColor: mode === m ? C.accent : 'transparent',
                    backgroundColor: mode === m ? C.accentBg : 'transparent',
                  }}
                  onPress={() => switchMode(m)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: mode === m }}
                  {...a11y(label)}
                >
                  <Text style={[T.sm, { fontWeight:'700', letterSpacing:1.2, color: mode === m ? C.accent : C.text3 }]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ padding:24, gap:16 }}>
              {mode === 'register' && (
                <Input
                  label="NOME COMPLETO"
                  value={name}
                  onChangeText={setName}
                  placeholder="Seu nome completo"
                  autoCapitalize="words"
                  error={fieldErrors.name}
                  hint="Mínimo 2 caracteres"
                />
              )}

              <Input
                label="E-MAIL"
                value={email}
                onChangeText={setEmail}
                placeholder="seu@email.com"
                keyboardType="email-address"
                error={fieldErrors.email}
                hint="Informe um e-mail válido"
              />

              <Input
                label="SENHA"
                value={senha}
                onChangeText={setSenha}
                placeholder="••••••••"
                secureTextEntry={!showPwd}
                error={fieldErrors.senha}
                hint={mode === 'register' ? 'Mínimo 8 caracteres com maiúscula, número e símbolo' : ''}
                right={
                  <TouchableOpacity onPress={() => setShowPwd(v => !v)} style={{ padding:4, minWidth:32, minHeight:32, alignItems:'center', justifyContent:'center' }} {...a11y(showPwd ? 'Ocultar senha' : 'Mostrar senha')}>
                    <Icon name={showPwd ? 'eyeOff' : 'eye'} size={18} color={C.text3}/>
                  </TouchableOpacity>
                }
              />

              {mode === 'register' && <PasswordStrengthBar password={senha}/>}

              {mode === 'register' && (
                <Input
                  label="CONFIRMAR SENHA"
                  value={confirma}
                  onChangeText={setConfirma}
                  placeholder="••••••••"
                  secureTextEntry={!showConfirm}
                  error={fieldErrors.confirma}
                  right={
                    <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={{ padding:4, minWidth:32, minHeight:32, alignItems:'center', justifyContent:'center' }} {...a11y(showConfirm ? 'Ocultar' : 'Mostrar')}>
                      <Icon name={showConfirm ? 'eyeOff' : 'eye'} size={18} color={C.text3}/>
                    </TouchableOpacity>
                  }
                />
              )}

              {/* Informação sobre o comportamento atual; não simula aceite jurídico. */}
              {mode === 'register' && (
                <Text style={[T.sm, { color:C.text2, lineHeight:22 }]}>
                  Seu e-mail é usado para acessar a conta. Eventos, notas e registros de humor
                  são salvos no aparelho e sincronizados com o serviço quando há conexão.
                  A foto de perfil fica apenas neste aparelho. Sair da conta mantém os dados
                  locais para o próximo acesso. A exclusão integral da conta ainda não está disponível no app.
                </Text>
              )}

              {!!erro && (
                <View style={{
                  backgroundColor:C.danger + '18', borderWidth:1,
                  borderColor:C.danger + '40', borderRadius:8,
                  padding:12, flexDirection:'row', alignItems:'flex-start', gap:8,
                }}>
                  <Icon name="error" size={16} color={C.danger}/>
                  <Text style={[T.sm, { flex:1, color:C.danger, lineHeight:20 }]}>{erro}</Text>
                </View>
              )}

              <TouchableOpacity
                style={{
                  backgroundColor: blocked ? C.bg4 : C.accent,
                  borderRadius:10, minHeight:52,
                  alignItems:'center', justifyContent:'center',
                  marginTop:4, opacity: loading ? 0.7 : 1,
                }}
                onPress={submit}
                disabled={loading || blocked}
                {...a11y(mode === 'login' ? 'Entrar na conta' : 'Criar nova conta')}
              >
                {loading
                  ? <ActivityIndicator color="#fff" size="small"/>
                  : <Text style={[T.base, { color:'#fff', fontWeight:'700', letterSpacing:1.2 }]}>
                      {mode === 'login' ? 'ENTRAR' : 'CRIAR CONTA'}
                    </Text>
                }
              </TouchableOpacity>

              {mode === 'login' && (
                <TouchableOpacity
                  onPress={() => switchMode('forgot')}
                  style={{ alignItems:'center', minHeight:44, justifyContent:'center' }}
                  {...a11y('Esqueceu a senha')}
                >
                  <Text style={[T.sm, { color:C.accent, fontWeight:'700' }]}>Esqueceu a senha?</Text>
                </TouchableOpacity>
              )}

              {/* Indicador de tentativas */}
              {attempts > 0 && mode === 'login' && (
                <View style={{ flexDirection:'row', alignItems:'center', gap:6, justifyContent:'center' }}>
                  <Icon name="shield" size={12} color={C.warn}/>
                  <Text style={[T.caption, { color:C.warn }]}>
                    {attempts} tentativa{attempts > 1 ? 's' : ''} falha{attempts > 1 ? 's' : ''} · Bloqueio em {5 - attempts}
                  </Text>
                </View>
              )}
            </View>
          </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}


export {ForgotPasswordForm, AuthScreen};
