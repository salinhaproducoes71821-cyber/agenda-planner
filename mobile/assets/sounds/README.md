# Sons de alarme das notificações

Cada arquivo é o som de **um canal de notificação** do Android (e o som no iOS).
Os arquivos atuais são **placeholders** (tons gerados) — substitua pelos seus
sons reais mantendo **exatamente os mesmos nomes**:

| Arquivo       | Opção no app | Canal Android      |
|---------------|--------------|--------------------|
| `gentle.wav`  | Suave        | `lembrete-gentle`  |
| `birds.wav`   | Pássaros     | `lembrete-birds`   |
| `piano.wav`   | Piano        | `lembrete-piano`   |
| `classic.wav` | Clássico     | `lembrete-classic` |

> "Apenas vibrar" não usa arquivo (canal `lembrete-vibrate`, sem som).

## Requisitos dos arquivos
- Formato **.wav** (PCM). Curtos: **1 a 5 segundos**.
- Nomes em minúsculo, idênticos aos acima.
- iOS aceita ≤ 30s; prefira .wav curto.

## Importante (canais Android são imutáveis)
O Android **congela o som de um canal no momento em que ele é criado**. Se você
trocar um `.wav` e o canal já existir no aparelho, o som **não muda** até
reinstalar o app (ou trocar o ID do canal no `App.js`). Em **build novo /
instalação limpa** o som novo é aplicado normalmente.

## Depois de trocar os arquivos
Rode um novo build (os sons são empacotados em tempo de build pelo plugin
`expo-notifications` → `sounds` no `app.json`):

```
cd mobile
eas build --profile preview --platform android
```
