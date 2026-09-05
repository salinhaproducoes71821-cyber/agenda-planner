import React from 'react';
import {useTheme} from './theme';
import {TopBar, Ornament, Icon} from './ui';
import {a11y, getTagColor} from './constants';
import {useState, useRef, useEffect} from 'react';
import api from './api-service';
import {Alert, View, TouchableOpacity, Text, KeyboardAvoidingView, Platform, TextInput, ScrollView, FlatList} from 'react-native';

function NotasScreen({ onMenu }) {
  const { C, T } = useTheme();
  const [notas,      setNotas]      = useState([]);
  const [query,      setQuery]      = useState('');
  const [activeTag,  setActiveTag]  = useState('');
  const [openNota,   setOpenNota]   = useState(null);
  const [editTitle,  setEditTitle]  = useState('');
  const [editBody,   setEditBody]   = useState('');
  const [editTags,   setEditTags]   = useState([]);
  const [tagInp,     setTagInp]     = useState('');
  const [saveSt,     setSaveSt]     = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const saveRevision = useRef(0);

  useEffect(() => {
    let mounted = true;
    const refresh = () => api.getLocal('notes').then(data => {if (mounted) setNotas(data);}).catch(() => {});
    const unsubscribe = api.subscribe(refresh);
    api.getNotes().then(data => {if (mounted) setNotas(data);}).catch(error => Alert.alert('Notas',error.message));
    return () => {mounted = false; unsubscribe();};
  }, []);

  const allTags  = [...new Set(notas.flatMap(n => n.tags))];
  const filtered = notas.filter(n => {
    const mQ = !query || n.titulo.toLowerCase().includes(query.toLowerCase()) || n.conteudo.toLowerCase().includes(query.toLowerCase());
    const mT = !activeTag || n.tags.includes(activeTag);
    return mQ && mT;
  });

  const openEditor = (nota) => {
    saveRevision.current++;
    setOpenNota(nota);
    setEditTitle(nota.titulo);
    setEditBody(nota.conteudo);
    setEditTags([...nota.tags]);
    setSaveSt('Salvo no aparelho');
    setShowEditor(true);
  };

  const closeEditor = () => {
    saveRevision.current++;
    setShowEditor(false);
    setOpenNota(null);
  };

  const createNota = async () => {
    try {
      const n = await api.createNote({ titulo: '', conteudo: '', tags: [] });
      setNotas(prev => [n, ...prev.filter(item => item.id !== n.id)]);
      openEditor(n);
    } catch (e) { Alert.alert('Erro', e.message); }
  };

  const autoSave = async (title, body, tags) => {
    if (!openNota) return;
    const revision = ++saveRevision.current;
    setSaveSt('Salvando no aparelho...');
    try {
      await api.updateNote(openNota.id, {titulo:title.trim(),conteudo:body,tags});
      if (saveRevision.current === revision) setSaveSt('Salvo no aparelho');

    } catch (error) {
      if (saveRevision.current === revision) setSaveSt('Não foi possível salvar');
      Alert.alert('Erro ao salvar',error.message);
    }
  };

  const addTag = () => {
    const t = tagInp.trim().toLowerCase();
    if (t.length > 50 || editTags.length >= 20) { Alert.alert('Etiquetas', 'Use até 20 etiquetas de 50 caracteres.'); return; }
    if (!t || editTags.includes(t)) { setTagInp(''); return; }
    const nt = [...editTags, t];
    setEditTags(nt);
    setTagInp('');
    autoSave(editTitle, editBody, nt);
  };

  const delNota = () => Alert.alert('Excluir nota', 'Esta ação não pode ser desfeita.', [
    { text:'Cancelar', style:'cancel' },
    { text:'Excluir',  style:'destructive', onPress: async () => {
      try {
        await api.deleteNote(openNota.id);
        setNotas(prev => prev.filter(n => n.id !== openNota.id));
      } catch (e) { Alert.alert('Erro', e.message); }
      closeEditor();
    }},
  ]);

  if (showEditor) return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <TopBar onMenuPress={onMenu} title="Notas"
        right={
          <TouchableOpacity
            style={{ minWidth:64, minHeight:44, alignItems:'center', justifyContent:'center' }}
            onPress={closeEditor}
            {...a11y('Voltar para a lista de notas')}
          >
            <Text style={[T.caption, { color:C.accent, fontWeight:'700', letterSpacing:0.5 }]}>VOLTAR</Text>
          </TouchableOpacity>
        }
      />
      <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
        <View style={{
          flexDirection:'row', alignItems:'center', justifyContent:'space-between',
          paddingHorizontal:20, paddingVertical:10,
          backgroundColor:C.bg2, borderBottomWidth:1, borderBottomColor:C.border,
        }}>
          <TouchableOpacity style={{ minHeight:44, justifyContent:'center' }} onPress={delNota} {...a11y('Excluir nota')}>
            <Text style={[T.caption, { color:C.danger, fontWeight:'700', letterSpacing:0.5 }]}>EXCLUIR</Text>
          </TouchableOpacity>
          <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
            <View style={{ width:7, height:7, borderRadius:4, backgroundColor: saveSt === 'Salvo no aparelho' ? C.success : C.warn }}/>
            <Text style={[T.caption, { color:C.text3 }]}>{saveSt}</Text>
          </View>
        </View>

        <TextInput
          style={[T.h2, { color:C.text, paddingHorizontal:20, paddingTop:18, paddingBottom:8 }]}
          placeholder="Sem título..."
          placeholderTextColor={C.text3}
          value={editTitle}
          maxLength={200}
          onChangeText={v => { setEditTitle(v); autoSave(v, editBody, editTags); }}
          accessibilityLabel="Título da nota"
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={{ maxHeight:44 }}
          contentContainerStyle={{ paddingHorizontal:20, alignItems:'center', gap:6 }}
        >
          {editTags.map(t => {
            const cl = getTagColor(t);
            return (
              <TouchableOpacity key={t}
                style={{ backgroundColor:cl + '22', paddingHorizontal:12, paddingVertical:6, borderRadius:20, minHeight:32 }}
                onPress={() => { const nt = editTags.filter(x => x !== t); setEditTags(nt); autoSave(editTitle, editBody, nt); }}
                {...a11y(`Remover etiqueta ${t}`)}
              >
                <Text style={[T.caption, { color:cl, fontWeight:'600' }]}>{t} ×</Text>
              </TouchableOpacity>
            );
          })}
          <TextInput
            style={[T.caption, { color:C.text2, minWidth:90, paddingVertical:6 }]}
            placeholder="+ etiqueta..."
            placeholderTextColor={C.text3}
            value={tagInp}
            onChangeText={setTagInp}
            onSubmitEditing={addTag}
            returnKeyType="done"
            blurOnSubmit={false}
            accessibilityLabel="Adicionar etiqueta"
          />
        </ScrollView>

        <Ornament style={{ marginHorizontal:20, marginVertical:10 }}/>

        <TextInput
          style={[T.body, { flex:1, color:C.text, paddingHorizontal:20, paddingBottom:16 }]}
          placeholder="Comece a escrever..."
          placeholderTextColor={C.text3}
          value={editBody}
          maxLength={50000}
          onChangeText={v => { setEditBody(v); autoSave(editTitle, v, editTags); }}
          multiline
          textAlignVertical="top"
          accessibilityLabel="Conteúdo da nota"
        />
      </KeyboardAvoidingView>
    </View>
  );

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <TopBar onMenuPress={onMenu} title="Notas" subtitle="Suas anotações"/>
      <View style={{ padding:16, paddingBottom:8 }}>
        <View style={{
          flexDirection:'row', alignItems:'center',
          backgroundColor:C.bg3, borderWidth:1.5, borderColor:C.border,
          borderRadius:10, paddingHorizontal:14, minHeight:52,
        }}>
          <Icon name="search" size={18} color={C.text3} style={{ marginRight:8 }}/>
          <TextInput
            style={[T.base, { flex:1, color:C.text }]}
            placeholder="Buscar notas..."
            placeholderTextColor={C.text3}
            value={query}
            onChangeText={setQuery}
            accessibilityLabel="Buscar notas"
          />
        </View>
      </View>

      {allTags.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={{ maxHeight:42 }}
          contentContainerStyle={{ paddingHorizontal:16, gap:6, alignItems:'center' }}
        >
          {allTags.map(t => (
            <TouchableOpacity key={t}
              style={{
                paddingHorizontal:14, paddingVertical:6, borderRadius:20, minHeight:34,
                backgroundColor: activeTag === t ? C.accentBg : C.bg3,
                borderWidth:1.5, borderColor: activeTag === t ? C.accent : C.border,
              }}
              onPress={() => setActiveTag(activeTag === t ? '' : t)}
              {...a11y(`${activeTag === t ? 'Remover' : 'Filtrar por'} etiqueta ${t}`)}
            >
              <Text style={[T.caption, { color:activeTag === t ? C.accent : C.text2, fontWeight:'600' }]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <FlatList
        data={filtered}
        keyExtractor={i => String(i.id)}
        contentContainerStyle={{ padding:16, gap:10, paddingBottom:120 }}
        ListHeaderComponent={() => (
          <TouchableOpacity
            style={{
              borderWidth:1.5, borderStyle:'dashed', borderColor:C.accent,
              borderRadius:10, paddingVertical:14, alignItems:'center', marginBottom:4, minHeight:52,
            }}
            onPress={createNota}
            {...a11y('Nova nota', 'Criar uma nova nota')}
          >
            <Text style={[T.base, { color:C.accent, fontWeight:'700', letterSpacing:0.5 }]}>+ Nova nota</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={() => (
          <View style={{ paddingVertical:40, alignItems:'center' }}>
            <Icon name="notes" size={36} color={C.text3} style={{ marginBottom:12 }}/>
            <Text style={[T.base, { color:C.text3 }]}>Nenhuma nota encontrada</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={{
              backgroundColor:C.bg2, borderRadius:10,
              borderWidth:1, borderColor:C.border,
              padding:16, gap:6,
            }}
            onPress={() => openEditor(item)}
            {...a11y(item.titulo || 'Sem título', item.conteudo?.substring(0, 80))}
          >
            <Text style={[T.h3, { color:C.text }]} numberOfLines={1}>{item.titulo || 'Sem título'}</Text>
            <Text style={[T.body, { color:C.text2 }]} numberOfLines={2}>{item.conteudo || ''}</Text>
            <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginTop:4 }}>
              <Text style={[T.caption, { color:C.text3, flexShrink:1, marginRight:8 }]} numberOfLines={1}>{item.updatedAt}</Text>
              <View style={{ flexDirection:'row', gap:4, flexShrink:1, maxWidth:'65%' }}>
                {item.tags.slice(0, 2).map(t => {
                  const cl = getTagColor(t);
                  return (
                    <View key={t} style={{ backgroundColor:cl + '22', paddingHorizontal:8, paddingVertical:3, borderRadius:20, flexShrink:1 }}>
                      <Text style={[T.caption, { color:cl, fontWeight:'600' }]} numberOfLines={1}>{t}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}


export {NotasScreen};
