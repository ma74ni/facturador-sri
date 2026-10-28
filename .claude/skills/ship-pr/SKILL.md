---
name: ship-pr
description: Verifica, sube y abre un PR contra dev siguiendo el flujo del repo (rama desde dev, checks, commit con atribución, PR en español). Úsalo cuando un cambio esté listo para revisión.
---

# Subir un cambio como PR

El flujo del repo: ramas cortas desde `dev`, un PR pequeño por cambio, el usuario revisa y mergea. `dev` se despliega en staging (Netlify `dev--facturador-siete8` y Render `facturador-core-dev`); `main` es producción.

## 1. Rama

Si estás en `dev` o `main`, crea una rama desde `origin/dev` actualizado: `fix/…`, `feat/…`, `chore/…`, `refactor/…`.

## 2. Checks (todos deben pasar)

```bash
pnpm lint:all
pnpm --filter facturacion-core test
pnpm --filter facturacion-core build
pnpm --filter web-facturacion type-check
pnpm --filter web-facturacion build   # solo si cambió la web
```

Revisa `git diff --stat`: nada de `.env`, `.p12`, XML de facturas reales, `docs/` internos ni `.claude/worktrees/`. El repo es **público**.

## 3. Commit

Mensaje convencional en inglés (`fix(scope): …`), cuerpo con el porqué. Termina con la línea de atribución que indique la sesión.

## 4. Push

```bash
git push -u origin <rama>
```

Si falla por credenciales HTTPS (pasa en el WSL del autor), usa SSH: `git push -u git@github.com:ma74ni/facturador-sri.git <rama>` y luego `git fetch git@github.com:ma74ni/facturador-sri.git +<rama>:refs/remotes/origin/<rama>` y `git branch -u origin/<rama>`. Para reescribir una rama propia ya subida: `--force-with-lease=<rama>:<sha esperado>`.

## 5. PR

Título = asunto del commit. Cuerpo **en español** con secciones: *Qué cambia* (y por qué), *Verificación* (comandos y resultados reales, incluido lo que no se probó) y *A tener en cuenta* (riesgos, pasos manuales, qué revisar en staging). Termina con la línea de atribución de la sesión.

```bash
gh pr create --base dev --title "<título>" --body-file <archivo>
```

Si `gh` no está autenticado en WSL, usa `gh.exe` (el de Windows) con el body en una ruta de Windows (`/mnt/c/Users/<usuario>/AppData/Local/Temp/pr-body.md` → `C:\Users\<usuario>\AppData\Local\Temp\pr-body.md`).

Para cambios que tocan emisión o endpoints, pasa antes por los agentes `sri-compliance-reviewer` y `tenant-security-reviewer`.
