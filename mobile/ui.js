import React from 'react';
import {ICON_MAP, a11y, SECURITY} from './constants';
import {useTheme} from './theme';
import {Ionicons} from '@expo/vector-icons';
import {View, TouchableOpacity, Text, TextInput, Platform, StatusBar} from 'react-native';
import {useState, useRef, useEffect, memo} from 'react';
import {SafeAreaView} from 'react-native-safe-area-context';

function Icon({ name, size = 16, color, style }) {
  return (
    <Ionicons
      name={ICON_MAP[name] || 'ellipse-outline'}
      size={size}
      color={color}
      style={style}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

function Ornament({ style }) {
  const { C } = useTheme();
  return (
    <View style={[{ flexDirection:'row', alignItems:'center', gap:6 }, style]}>
      <View style={{ flex:1, height:1, backgroundColor:C.border2 }}/>
      <Ionicons name="star-outline" size={10} color={C.text3} accessibilityElementsHidden importantForAccessibility="no"/>
      <View style={{ flex:1, height:1, backgroundColor:C.border2 }}/>
    </View>
  );
}

function Btn({ onPress, style, children, label, hint, disabled, variant = 'default' }) {
  const { C } = useTheme();
  const bg = variant === 'primary' ? C.accent
           : variant === 'danger'  ? C.danger
           : variant === 'ghost'   ? 'transparent'
           : C.bg3;
  return (
    <TouchableOpacity
      style={[{
        minHeight: 48,
        minWidth:  48,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: bg,
        opacity: disabled ? 0.5 : 1,
        borderWidth: variant === 'ghost' ? 1 : 0,
        borderColor: C.border2,
      }, style]}
      onPress={onPress}
      disabled={disabled}
      {...a11y(label || '', hint)}
    >
      {children}
    </TouchableOpacity>
  );
}

function Input({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType, autoCapitalize, error, hint, right, ...props }) {
  const { C, T } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={[T.label, { color: C.text3 }]}>{label}</Text> : null}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.bg3,
        borderWidth: 1.5,
        borderColor: error ? C.danger : focused ? C.accent : C.border,
        borderRadius: 10,
        paddingHorizontal: 14,
        minHeight: 52,
      }}>
        <TextInput
          style={[T.base, { flex:1, color: C.text, paddingVertical: 0 }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={C.text3}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize || 'none'}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={label}
          accessibilityHint={hint}
          // CORREÇÃO: autoCorrect desabilitado em campos de senha por segurança
          autoCorrect={secureTextEntry ? false : props.autoCorrect}
          {...props}
        />
        {right}
      </View>
      {error ? (
        <View style={{ flexDirection:'row', alignItems:'center', gap:4 }}>
          <Icon name="error" size={12} color={C.danger}/>
          <Text style={[T.caption, { color: C.danger }]}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

function PasswordStrengthBar({ password }) {
  const { C, T } = useTheme();
  const strength = SECURITY.passwordStrength(password);
  if (!password) return null;
  // CORREÇÃO: validatePassword chamado uma vez só em vez de duas
  const requisitos = SECURITY.validatePassword(password);
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection:'row', gap:4 }}>
        {[1,2,3,4,5].map(i => (
          <View key={i} style={{
            flex:1, height:4, borderRadius:2,
            backgroundColor: i <= strength.level ? strength.color : C.bg4,
          }}/>
        ))}
      </View>
      <Text style={[T.caption, { color: strength.color, fontWeight:'600' }]}>
        {strength.label}
      </Text>
      {requisitos.length > 0 && (
        <View style={{ gap:3 }}>
          {requisitos.map((req, i) => (
            <View key={i} style={{ flexDirection:'row', alignItems:'center', gap:4 }}>
              <Text style={{ fontSize:10, color:C.warn }}>• </Text>
              <Text style={[T.caption, { color:C.text3 }]}>{req}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function TopBar({ onMenuPress, title, subtitle, right }) {
  const { C, T } = useTheme();
  // Aplica apenas o inset superior manualmente para evitar que SafeAreaView
  // adicione também inset inferior dentro da barra de navegação
  const topPad = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;
  return (
    <SafeAreaView edges={[]} style={{ backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.border2 }}>
      <StatusBar
        barStyle={C.bg === '#f5f0e8' || C.bg === '#f0f4f8' ? 'dark-content' : 'light-content'}
        backgroundColor={C.bg}
        translucent={false}
      />
      <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, minHeight:56 }}>
        <TouchableOpacity
          style={{ width:48, height:48, alignItems:'center', justifyContent:'center' }}
          onPress={onMenuPress}
          {...a11y('Menu lateral', 'Abre o menu de navegação')}
        >
          <View style={{ gap: 5 }}>
            {[20, 14, 20].map((w, i) => (
              <View key={i} style={{ width:w, height:2, borderRadius:1, backgroundColor:C.text2 }}/>
            ))}
          </View>
        </TouchableOpacity>

        <View style={{ alignItems:'center', flex:1, paddingHorizontal:8 }}>
          <Text style={[T.h3, { color:C.text, letterSpacing:0.3 }]} accessibilityRole="header">{title}</Text>
          {subtitle ? <Text style={[T.caption, { color:C.text3, marginTop:2, letterSpacing:0.6 }]}>{subtitle}</Text> : null}
        </View>

        <View style={{ width:48, alignItems:'flex-end' }}>
          {right || <View style={{ width:48 }}/>}
        </View>
      </View>
    </SafeAreaView>
  );
}

function TrackSlider({ value, max, onChange, onChanging, color, showTooltip = false, formatTooltip = v => String(Math.round(v)) }) {
  const [w, setW]             = useState(300);
  const [display, setDisplay] = useState(value);
  const [dragging, setDragging] = useState(false);
  const wRef        = useRef(300);
  const displayRef  = useRef(value);
  const draggingRef = useRef(false);
  const gestureRef  = useRef({ startPageX:0, startPageY:0, startVal:0, dir:null });

  useEffect(() => {
    if (!draggingRef.current) {
      displayRef.current = value;
      setDisplay(value);
    }
  }, [value]);

  const ratio    = max > 0 ? Math.min(1, Math.max(0, display / max)) : 0;
  const thumbLeft = Math.max(0, Math.min(ratio * w - 9, w - 18));

  const snapVal = (locationX) =>
    Math.max(0, Math.min(max, (locationX / wRef.current) * max));

  const valFromDx = (pageX) => {
    const delta = ((pageX - gestureRef.current.startPageX) / wRef.current) * max;
    return Math.max(0, Math.min(max, gestureRef.current.startVal + delta));
  };

  return (
    <View
      style={{ height:44, justifyContent:'center' }}
      onLayout={e => {
        wRef.current = e.nativeEvent.layout.width;
        setW(e.nativeEvent.layout.width);
      }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => gestureRef.current.dir === 'v'}
      onResponderGrant={e => {
        draggingRef.current = true;
        setDragging(true);
        const snapped = snapVal(e.nativeEvent.locationX);
        displayRef.current = snapped;
        setDisplay(snapped);
        onChanging?.(snapped);
        gestureRef.current = {
          startPageX: e.nativeEvent.pageX,
          startPageY: e.nativeEvent.pageY,
          startVal:   snapped,
          dir:        null,
        };
      }}
      onResponderMove={e => {
        const dx = Math.abs(e.nativeEvent.pageX - gestureRef.current.startPageX);
        const dy = Math.abs(e.nativeEvent.pageY - gestureRef.current.startPageY);
        if (!gestureRef.current.dir && (dx > 3 || dy > 3)) {
          gestureRef.current.dir = dy > dx * 2 ? 'v' : 'h';
        }
        if (gestureRef.current.dir !== 'v') {
          const v = valFromDx(e.nativeEvent.pageX);
          displayRef.current = v;
          setDisplay(v);
          onChanging?.(v);
        }
      }}
      onResponderRelease={e => {
        if (gestureRef.current.dir !== 'v') {
          const v = valFromDx(e.nativeEvent.pageX);
          displayRef.current = v;
          setDisplay(v);
          onChanging?.(v);
          onChange(v);
        }
        draggingRef.current = false;
        setDragging(false);
      }}
      onResponderTerminate={() => {
        draggingRef.current = false;
        setDragging(false);
        gestureRef.current.dir = null;
      }}
    >
      {/* Tooltip de tempo — visível apenas durante drag */}
      {showTooltip && dragging && (
        <View style={{
          position:'absolute', top:0,
          left: Math.max(0, thumbLeft - 12),
          backgroundColor: color,
          paddingHorizontal:6, paddingVertical:2,
          borderRadius:4, zIndex:10,
        }}>
          <Text style={{ color:'#fff', fontSize:10, fontWeight:'700' }}>
            {formatTooltip(display)}
          </Text>
        </View>
      )}

      {/* Track */}
      <View style={{ height:6, borderRadius:3, backgroundColor:'rgba(128,128,128,0.25)', overflow:'hidden' }}>
        <View style={{ width:`${Math.round(ratio * 100)}%`, height:'100%', backgroundColor:color }}/>
      </View>

      {/* Thumb */}
      <View style={{
        position:'absolute', top:13,
        left: thumbLeft,
        width:18, height:18, borderRadius:9,
        backgroundColor:color,
        elevation:4,
        shadowColor:'#000', shadowOffset:{width:0,height:2},
        shadowOpacity:0.25, shadowRadius:4,
      }}/>
    </View>
  );
}

const Section = memo(function Section({ label, children }) {
  const { C, T } = useTheme();
  return (
    <View style={{ backgroundColor:C.bg2, borderRadius:14, borderWidth:1, borderColor:C.border2, padding:16, gap:14 }}>
      <Text style={[T.label, { color:C.text3 }]}>{label}</Text>
      {children}
    </View>
  );
});


export {Icon, Ornament, Btn, Input, PasswordStrengthBar, TopBar, TrackSlider, Section};
