# Sons de alarme das notificações

Cada arquivo é o som de **um canal de notificação** do Android (e o som no iOS).

| Arquivo       | Opção no app | Canal Android      | Origem            |
|---------------|--------------|--------------------|-------------------|
| `classic.mp3` | Clássico     | `lembrete-classic` | Over the Horizon  |
| `piano.mp3`   | Piano        | `lembrete-piano`   | Nokia Piano       |
| `birds.mp3`   | Pássaros     | `lembrete-birds`   | Ringtone Bird     |

> "Apenas vibrar" não usa arquivo (canal `lembrete-vibrate`, sem som).

Os áudios foram cortados para ~5–12s (mono, 128k) — som de notificação deve ser
curto (iOS rejeita > 30s e arquivos grandes incham o bundle).

## Para trocar um som
Substitua o arquivo mantendo **exatamente o mesmo nome** e formato curto (.mp3
ou .wav, 1–12s, nome em minúsculo). Depois rode um novo build.

## Importante (canais Android são imutáveis)
O Android **congela o som de um canal no momento em que ele é criado**. Se você
trocar um arquivo e o canal já existir no aparelho, o som **não muda** até
reinstalar o app (instalação limpa) ou trocar o ID do canal no `App.js`.

## Build
Os sons são empacotados em tempo de build pelo plugin `expo-notifications`
(`sounds[]` no `app.json`):

```
cd mobile
eas build --profile preview --platform android
```
