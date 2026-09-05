import React from 'react';
import {useTheme, THEMES, ACCENT_COLORS, FONT_FAMILIES, FONT_SIZES} from './theme';
import {TopBar, Section, Icon, Input, Btn, Ornament} from './ui';
import {a11y} from './constants';
import {useAuth} from './auth-context';
import {useState} from 'react';
import {Alert, View, ScrollView, TouchableOpacity, Image, Text, Switch} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

function ConfigScreen({ onMenu }) {
  const { C, T, themeId, fontFamily, fontSize, accentId, highContrast, setTheme, setFont, setSize, setAccent, toggleHC } = useTheme();
  const { currentUser, logout, updateAvatar, updateProfile } = useAuth();
  const [editingName, setEditingName] = useState(false);
  const [newName,     setNewName]     = useState('');

  const initials = currentUser?.name
    ? currentUser.name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
    : '?';

  const handleLogout = () => Alert.alert('Sair', 'Deseja encerrar a sessão?', [
    { text:'Cancelar', style:'cancel' },
    { text:'Sair', style:'destructive', onPress: logout },
  ]);

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão negada', 'Precisamos de acesso à galeria para alterar a foto.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      try { await updateAvatar(result.assets[0].uri); }
      catch (e) { Alert.alert('Erro', e.message); }
    }
  };

  const saveName = async () => {
    if (newName.trim().length < 2) { Alert.alert('Nome inválido', 'Mínimo 2 caracteres'); return; }
    try { await updateProfile(newName.trim()); setEditingName(false); } catch (error) { Alert.alert('Erro',error.message); }
  };

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <TopBar onMenuPress={onMenu} title="Personalizar" subtitle="Tema, fontes e aparência"/>
      <ScrollView contentContainerStyle={{ padding:16, gap:16, paddingBottom:48 }}>

        {/* Perfil com foto */}
        <Section label="perfil">
          <View style={{ alignItems:'center', gap:14 }}>
            <TouchableOpacity onPress={pickPhoto} {...a11y('Alterar foto de perfil')}>
              <View style={{ position:'relative' }}>
                {currentUser?.avatar
                  ? <Image source={{ uri:currentUser.avatar }} style={{ width:80, height:80, borderRadius:40, borderWidth:2, borderColor:C.accent }}/>
                  : (
                    <View style={{
                      width:80, height:80, borderRadius:40,
                      backgroundColor:C.accentBg, borderWidth:2, borderColor:C.accent,
                      alignItems:'center', justifyContent:'center',
                    }}>
                      <Text style={[T.h2, { color:C.accent }]}>{initials}</Text>
                    </View>
                  )
                }
                <View style={{
                  position:'absolute', bottom:0, right:0,
                  width:26, height:26, borderRadius:13,
                  backgroundColor:C.accent,
                  borderWidth:2, borderColor:C.bg2,
                  alignItems:'center', justifyContent:'center',
                }}>
                  <Icon name="photo" size={12} color="#fff"/>
                </View>
              </View>
            </TouchableOpacity>

            {editingName
              ? (
                <View style={{ width:'100%', gap:10 }}>
                  <Input
                    label="NOVO NOME"
                    value={newName}
                    onChangeText={setNewName}
                    placeholder="Seu nome"
                    autoCapitalize="words"
                  />
                  <View style={{ flexDirection:'row', gap:8 }}>
                    <Btn onPress={() => setEditingName(false)} style={{ flex:1 }} label="Cancelar">
                      <Text style={[T.sm, { color:C.text2, fontWeight:'600' }]}>Cancelar</Text>
                    </Btn>
                    <Btn onPress={saveName} variant="primary" style={{ flex:1 }} label="Salvar nome">
                      <Text style={[T.sm, { color:'#fff', fontWeight:'700' }]}>Salvar</Text>
                    </Btn>
                  </View>
                </View>
              )
              : (
                <View style={{ alignItems:'center' }}>
                  <Text style={[T.h3, { color:C.text }]}>{currentUser?.name || 'Usuário'}</Text>
                  <Text style={[T.caption, { color:C.text3, marginTop:2 }]}>{currentUser?.email || '—'}</Text>
                  <TouchableOpacity
                    style={{ marginTop:10, paddingHorizontal:16, paddingVertical:8, borderRadius:20, borderWidth:1, borderColor:C.border2, minHeight:36 }}
                    onPress={() => { setNewName(currentUser?.name || ''); setEditingName(true); }}
                    {...a11y('Editar nome')}
                  >
                    <Text style={[T.caption, { color:C.accent, fontWeight:'700' }]}>EDITAR NOME</Text>
                  </TouchableOpacity>
                </View>
              )
            }
          </View>
        </Section>

        {/* Acessibilidade */}
        <Section label="acessibilidade">
          <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', minHeight:48 }}>
            <View style={{ flex:1 }}>
              <Text style={[T.base, { color:C.text, fontWeight:'600' }]}>Alto contraste</Text>
              <Text style={[T.caption, { color:C.text3, marginTop:2 }]}>Melhora a legibilidade</Text>
            </View>
            <Switch
              value={highContrast}
              onValueChange={toggleHC}
              trackColor={{ false:C.bg4, true:C.accent }}
              thumbColor="#fff"
              accessibilityLabel="Alternar alto contraste"
            />
          </View>
        </Section>

        {/* Temas — 10 opções */}
        <Section label="tema da agenda">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap:8 }}>
            {Object.values(THEMES).map(theme => (
              <TouchableOpacity key={theme.id}
                style={{
                  width:110, borderRadius:12, overflow:'hidden',
                  borderWidth:2, borderColor: themeId === theme.id ? C.accent : C.border,
                }}
                onPress={() => setTheme(theme.id)}
                {...a11y(theme.name, theme.description)}
              >
                {/* Preview */}
                <View style={{ height:52, backgroundColor:theme.bg, padding:8, gap:4 }}>
                  <View style={{ height:8, borderRadius:4, backgroundColor:theme.accent, width:'70%' }}/>
                  <View style={{ height:6, borderRadius:3, backgroundColor:theme.text3, width:'50%' }}/>
                  <View style={{ flexDirection:'row', gap:4, marginTop:2 }}>
                    {[theme.accent, theme.success, theme.danger].map((c, i) => (
                      <View key={i} style={{ width:10, height:10, borderRadius:5, backgroundColor:c }}/>
                    ))}
                  </View>
                </View>
                <View style={{ backgroundColor:theme.bg2, padding:8 }}>
                  <Text style={{ fontSize:12, color:theme.text, fontWeight:'700' }}>{theme.name}</Text>
                  <Text style={{ fontSize:10, color:theme.text3, marginTop:1 }}>{theme.description}</Text>
                </View>
                {themeId === theme.id && (
                  <View style={{ position:'absolute', top:6, right:6, width:18, height:18, borderRadius:9, backgroundColor:C.accent, alignItems:'center', justifyContent:'center' }}>
                    {/* CORREÇÃO: size do ícone de check reduzido para caber no container 18x18 */}
                    <Icon name="check" size={10} color="#fff"/>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Section>

        {/* Cor de destaque — 12 opções */}
        <Section label="cor de destaque">
          <View style={{ flexDirection:'row', flexWrap:'wrap', gap:10 }}>
            {ACCENT_COLORS.map(a => (
              <TouchableOpacity key={a.id}
                style={{
                  alignItems:'center', gap:5,
                  paddingVertical:8, paddingHorizontal:10,
                  borderRadius:10, minHeight:56, minWidth:56,
                  backgroundColor: accentId === a.id ? a.color + '22' : C.bg3,
                  borderWidth:2, borderColor: accentId === a.id ? a.color : C.border,
                }}
                onPress={() => setAccent(accentId === a.id ? null : a.id)}
                {...a11y(a.name, accentId === a.id ? 'Selecionada. Toque para usar a cor do tema.' : 'Selecionar')}
              >
                <View style={{ width:24, height:24, borderRadius:12, backgroundColor:a.color }}/>
                <Text style={[T.caption, { color:C.text3, fontWeight:'600', textAlign:'center' }]}>{a.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[T.caption, { color:C.text3 }]}>Toque na cor selecionada para usar a padrão do tema</Text>
        </Section>

        {/* Família de fonte */}
        <Section label="estilo da fonte">
          <View style={{ flexDirection:'row', gap:8 }}>
            {Object.values(FONT_FAMILIES).map(f => (
              <TouchableOpacity key={f.id}
                style={{
                  flex:1, paddingVertical:14, paddingHorizontal:8,
                  borderRadius:10, alignItems:'center', gap:6, minHeight:72,
                  backgroundColor: fontFamily === f.id ? C.accentBg : C.bg3,
                  borderWidth:2, borderColor: fontFamily === f.id ? C.accent : C.border,
                }}
                onPress={() => setFont(f.id)}
                {...a11y(f.label, fontFamily === f.id ? 'Selecionada' : 'Selecionar')}
              >
                <Text style={{ fontSize:18, color:C.text, fontFamily:f.family, fontWeight:'700' }}>Aa</Text>
                <Text style={[T.caption, { color:fontFamily === f.id ? C.accent : C.text3, fontWeight:'600', textAlign:'center' }]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Section>

        {/* Tamanho da fonte */}
        <Section label="tamanho do texto">
          <View style={{ flexDirection:'row', gap:8 }}>
            {Object.values(FONT_SIZES).map(f => (
              <TouchableOpacity key={f.id}
                style={{
                  flex:1, paddingVertical:14,
                  borderRadius:10, alignItems:'center', gap:6, minHeight:72,
                  backgroundColor: fontSize === f.id ? C.accentBg : C.bg3,
                  borderWidth:2, borderColor: fontSize === f.id ? C.accent : C.border,
                }}
                onPress={() => setSize(f.id)}
                {...a11y(`Tamanho ${f.name}`, fontSize === f.id ? 'Selecionado' : 'Selecionar')}
              >
                <Text style={{ fontSize:f.base, color:C.text, fontWeight:'700' }}>A</Text>
                <Text style={[T.caption, { color:fontSize === f.id ? C.accent : C.text3, fontWeight:'600', textAlign:'center', fontSize:11 }]}>{f.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Section>

        {/* Prévia */}
        <View style={{ backgroundColor:C.bg2, borderRadius:14, borderWidth:1, borderColor:C.border2, padding:20, gap:8 }}>
          <Text style={[T.label, { color:C.text3, marginBottom:4 }]}>prévia do texto</Text>
          <Text style={[T.h1, { color:C.text }]}>Reunião de equipe</Text>
          <Text style={[T.body, { color:C.text2 }]}>Segunda-feira, 12 de Maio</Text>
          <Text style={[T.base, { color:C.text3 }]}>Sala de reuniões • 10:00 — 11:30</Text>
          <Ornament style={{ marginTop:8 }}/>
          <Text style={[T.caption, { color:C.text3, textAlign:'center', marginTop:4 }]}>
            Prévia com seu estilo atual
          </Text>
        </View>

        {/* Conta */}
        <Section label="conta">
          <TouchableOpacity
            style={{ minHeight:48, justifyContent:'center' }}
            onPress={handleLogout}
            {...a11y('Sair da conta', 'Encerra a sessão atual')}
          >
            <Text style={[T.base, { color:C.danger, fontWeight:'700' }]}>Sair da conta</Text>
          </TouchableOpacity>
        </Section>

        <Text style={[T.caption, { textAlign:'center', color:C.text3, letterSpacing:2.5 }]}>
          AGENDA v3.0.0
        </Text>
      </ScrollView>
    </View>
  );
}


export {ConfigScreen};
