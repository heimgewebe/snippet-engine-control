# Adapters

Adapter (Espanso zuerst)
`packages/adapter-espanso/src/`

Designregel:
* Adapter darf **nur** Engine-spezifisches wissen.
* Adapter darf keine UI-Logik enthalten.

## Espanso Adapter
* `discover.ts` - find config dirs
* `read.ts` - parse match/*.yml into IR
* `write.ts` - write IR back to espanso YAML
* `restart.ts` - espanso restart/status/log
* `doctor.ts` - common failure modes (X11/Wayland, service, etc.)

## Test-Strategie
* adapter-espanso: golden tests
  * input YAML → IR snapshot
  * IR → output YAML snapshot
