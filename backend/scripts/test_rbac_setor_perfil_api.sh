#!/usr/bin/env bash
# Teste de API: RBAC de projetos por setor + perfil (foto/assinatura/cargo) + assinatura nas respostas.
# Uso: bash test_rbac.sh <BASE_URL>
# Cenário (test_users_rbac.sql): admin (ADMIN), gestor (GESTOR_PROJETO, TI), colab (COLABORADOR, Financeiro),
# colab2 (COLABORADOR, RH), cliente (CLIENTE, Financeiro), viewer (VISUALIZADOR, RH), semsetor (CLIENTE, sem setor).
set -u
BASE=${1:-http://127.0.0.1:5001}
PASS='Fase3Teste!2026'
OK=0; FAIL=0
pass(){ OK=$((OK+1)); echo "  PASS  $1"; }
fail(){ FAIL=$((FAIL+1)); echo "  FAIL  $1  -> $2"; }
check(){ if [ "$2" = "$3" ]; then pass "$1 ($3)"; else fail "$1" "esperado $2, veio $3 ${4:-}"; fi; }
req(){ local m=$1 p=$2 t=$3 d=${4:-}; local out
  if [ -n "$d" ]; then out=$(curl -s -o /tmp/rb_body -w "%{http_code}" -X "$m" "$BASE$p" -H "Content-Type: application/json" ${t:+-H "Authorization: Bearer $t"} -d "$d")
  else out=$(curl -s -o /tmp/rb_body -w "%{http_code}" -X "$m" "$BASE$p" ${t:+-H "Authorization: Bearer $t"}); fi
  CODE=$out; BODY=$(cat /tmp/rb_body); }
login(){ curl -s -X POST "$BASE/users/login" -H "Content-Type: application/json" -d "{\"email\":\"$1\",\"password\":\"$PASS\"}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token') or '')"; }
jget(){ python3 -c "import sys,json; d=json.load(sys.stdin); print(eval(\"d$1\"))" 2>/dev/null; }
jlen(){ python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null; }
has_id(){ python3 -c "import sys,json; d=json.load(sys.stdin); print(any(p.get('id')=='$1' for p in d))" 2>/dev/null; }

echo "== login"
TA=$(login f3admin@teste.local); TG=$(login f3gestor@teste.local); TB=$(login f3colab@teste.local); TD=$(login f3colab2@teste.local)
TC=$(login f3cliente@teste.local); TV=$(login f3viewer@teste.local); TS=$(login f3semsetor@teste.local)
for n in TA TG TB TD TC TV TS; do [ -n "${!n}" ] && pass "login $n" || fail "login $n" "token vazio"; done
me(){ curl -s "$BASE/users/me" -H "Authorization: Bearer $1"; }
IDB=$(me "$TB" | jget "['id']"); IDD=$(me "$TD" | jget "['id']"); IDC=$(me "$TC" | jget "['id']"); IDG=$(me "$TG" | jget "['id']"); IDS=$(me "$TS" | jget "['id']")
DEPT_FIN=$(me "$TB" | jget "['department_id']"); DEPT_RH=$(me "$TD" | jget "['department_id']")
echo "  ids: colab=$IDB colab2=$IDD cliente=$IDC gestor=$IDG semsetor=$IDS | setores: fin=$DEPT_FIN rh=$DEPT_RH"

echo "== acesso ao módulo de gestão"
req GET /gestao/projects/ "$TC"; check "CLIENTE lista projetos (antes 403)" 200 "$CODE"
req GET /gestao/teams/staff "$TC"; check "CLIENTE lista pessoas" 200 "$CODE"
echo "$BODY" | grep -q "f3cliente@teste.local" && pass "CLIENTE aparece na lista de pessoas (responsável/chat)" || fail "CLIENTE na lista" "$(echo "$BODY" | head -c 200)"
req GET /gestao/messages/unread "$TC"; check "CLIENTE acessa chat" 200 "$CODE"

echo "== criação de projeto por setor"
req POST /gestao/projects/ "$TB" "{\"name\":\"Proj Financeiro (colab)\",\"department_id\":$DEPT_RH}"; check "colab cria projeto (tenta forçar setor RH)" 201 "$CODE" "$BODY"
P_FIN=$(echo "$BODY" | jget "['project']['id']"); DEP=$(echo "$BODY" | jget "['project']['department_id']")
[ "$DEP" = "$DEPT_FIN" ] && pass "setor forçado pro próprio (Financeiro=$DEP)" || fail "setor forçado" "veio $DEP"
req POST /gestao/projects/ "$TD" '{"name":"Proj RH (colab2)"}'; check "colab2 cria projeto no RH" 201 "$CODE" "$BODY"
P_RH=$(echo "$BODY" | jget "['project']['id']")
req POST /gestao/projects/ "$TC" '{"name":"Proj Financeiro (cliente)"}'; check "CLIENTE cria projeto no próprio setor" 201 "$CODE" "$BODY"
P_FIN2=$(echo "$BODY" | jget "['project']['id']")
req POST /gestao/projects/ "$TS" '{"name":"Proj sem setor"}'; check "usuário sem setor não cria projeto" 422 "$CODE"
req POST /gestao/projects/ "$TV" '{"name":"Proj viewer"}'; check "VISUALIZADOR cria projeto" 403 "$CODE"
req POST /gestao/projects/ "$TG" "{\"name\":\"Proj RH (gestor)\",\"department_id\":$DEPT_RH}"; check "GESTOR cria projeto em outro setor (RH)" 201 "$CODE" "$BODY"
P_RH_G=$(echo "$BODY" | jget "['project']['id']")
req POST /gestao/projects/ "$TA" '{"name":"Proj sem setor (admin)","department_id":null}'; check "ADMIN cria projeto sem setor" 201 "$CODE" "$BODY"
P_NONE=$(echo "$BODY" | jget "['project']['id']")
req POST /gestao/projects/ "$TA" '{"name":"Proj setor inválido","department_id":99999}'; check "setor inexistente rejeitado" 422 "$CODE"

echo "== visibilidade"
req GET /gestao/projects/ "$TB"; N=$(echo "$BODY" | jlen)
[ "$(echo "$BODY" | has_id "$P_FIN")" = True ] && [ "$(echo "$BODY" | has_id "$P_FIN2")" = True ] && [ "$(echo "$BODY" | has_id "$P_RH")" = False ] && [ "$(echo "$BODY" | has_id "$P_NONE")" = False ] && pass "colab (Financeiro) vê só os 2 do Financeiro ($N no total)" || fail "colab visibilidade" "$BODY"
req GET /gestao/projects/ "$TC"; [ "$(echo "$BODY" | has_id "$P_FIN")" = True ] && [ "$(echo "$BODY" | has_id "$P_RH")" = False ] && pass "CLIENTE (Financeiro) vê o do Financeiro e não o do RH" || fail "cliente visibilidade" "$BODY"
req GET /gestao/projects/ "$TD"; [ "$(echo "$BODY" | has_id "$P_RH")" = True ] && [ "$(echo "$BODY" | has_id "$P_RH_G")" = True ] && [ "$(echo "$BODY" | has_id "$P_FIN")" = False ] && pass "colab2 (RH) vê os 2 do RH e não o do Financeiro" || fail "colab2 visibilidade" "$BODY"
req GET /gestao/projects/ "$TS"; N=$(echo "$BODY" | jlen); [ "$N" = "0" ] && pass "sem setor não vê nada" || fail "sem setor" "$BODY"
req GET /gestao/projects/ "$TV"; [ "$(echo "$BODY" | has_id "$P_FIN")" = True ] && [ "$(echo "$BODY" | has_id "$P_NONE")" = True ] && pass "VISUALIZADOR vê tudo (inclusive sem setor)" || fail "viewer vê tudo" "$BODY"
req GET /gestao/projects/ "$TA"; [ "$(echo "$BODY" | has_id "$P_NONE")" = True ] && pass "ADMIN vê tudo" || fail "admin vê tudo" "$BODY"
req GET /gestao/projects/ "$TG"; [ "$(echo "$BODY" | has_id "$P_RH_G")" = True ] && [ "$(echo "$BODY" | has_id "$P_FIN")" = False ] && pass "GESTOR (TI) vê o que criou no RH mas não o Financeiro (não é dono)" || fail "gestor visibilidade" "$BODY"
req GET "/gestao/projects/$P_RH" "$TB"; check "colab abre projeto de outro setor por id" 404 "$CODE"
req GET "/gestao/projects/$P_RH/board" "$TB"; check "colab abre quadro de projeto de outro setor" 404 "$CODE"
req GET "/gestao/projects/$P_FIN" "$TC"; check "CLIENTE abre projeto do próprio setor" 200 "$CODE"
req GET "/gestao/tasks/?project_id=$P_RH" "$TB"; N=$(echo "$BODY" | jlen); [ "$N" = "0" ] && pass "tarefas de projeto alheio não listadas" || fail "tarefas alheias" "$BODY"

echo "== tarefas"
req POST /gestao/tasks/ "$TD" "{\"project_id\":\"$P_FIN\",\"title\":\"intrusa\"}"; check "colab2 cria tarefa em projeto de outro setor" 404 "$CODE"
req POST /gestao/tasks/ "$TC" "{\"project_id\":\"$P_FIN\",\"title\":\"Tarefa do cliente\"}"; check "CLIENTE cria tarefa no projeto do setor (antes 403)" 201 "$CODE" "$BODY"
T1=$(echo "$BODY" | jget "['task']['id']"); [ -z "$T1" ] && T1=$(echo "$BODY" | jget "['id']")
req POST /gestao/tasks/ "$TV" "{\"project_id\":\"$P_FIN\",\"title\":\"viewer\"}"; check "VISUALIZADOR cria tarefa" 403 "$CODE"
req POST /gestao/tasks/ "$TB" "{\"project_id\":\"$P_FIN\",\"title\":\"Tarefa pro colab2\",\"assignee_id\":$IDD}"; check "colab cria tarefa e atribui ao colab2 (RH)" 201 "$CODE" "$BODY"
req GET /gestao/projects/ "$TD"; [ "$(echo "$BODY" | has_id "$P_FIN")" = True ] && pass "colab2 passa a ver o projeto do Financeiro por ser responsável de tarefa" || fail "responsável vê projeto" "$BODY"
req GET "/gestao/projects/$P_FIN" "$TD"; check "colab2 abre o projeto do Financeiro agora" 200 "$CODE"

echo "== gestão do projeto (editar setor / dono)"
req PATCH "/gestao/projects/$P_FIN" "$TB" "{\"department_id\":$DEPT_RH}"; check "colab (dono) tenta mudar setor" 403 "$CODE"
req PATCH "/gestao/projects/$P_FIN" "$TB" '{"description":"editado pelo dono"}'; check "colab (dono) edita descrição" 200 "$CODE" "$BODY"
req PATCH "/gestao/projects/$P_FIN2" "$TB" '{"description":"editado por não-dono"}'; check "colab edita projeto do setor que não é dele (não-dono)" 403 "$CODE"
req PATCH "/gestao/projects/$P_RH" "$TA" "{\"department_id\":$DEPT_FIN}"; check "ADMIN muda setor do projeto RH -> Financeiro" 200 "$CODE" "$BODY"
req GET /gestao/projects/ "$TB"; [ "$(echo "$BODY" | has_id "$P_RH")" = True ] && pass "colab (Financeiro) passa a ver o projeto movido" || fail "projeto movido" "$BODY"
req PATCH "/gestao/projects/$P_RH" "$TA" "{\"department_id\":$DEPT_RH}"; check "ADMIN devolve o setor" 200 "$CODE"

echo "== perfil próprio"
req PUT "/users/$IDB" "$TB" "{\"cargo\":\"Analista Financeiro\",\"ramal\":\"123\",\"whatsapp\":\"(31) 99999-0000\",\"department_id\":$DEPT_RH,\"access_type\":\"ADMIN\",\"nivel_hierarquico\":\"GERENCIA\"}"; check "colab atualiza cargo/ramal/whatsapp (tentando escalar setor/papel/nível)" 200 "$CODE" "$BODY"
ME=$(me "$TB"); [ "$(echo "$ME" | jget "['cargo']")" = "Analista Financeiro" ] && pass "cargo salvo" || fail "cargo" "$ME"
[ "$(echo "$ME" | jget "['department_id']")" = "$DEPT_FIN" ] && [ "$(echo "$ME" | jget "['access_type']")" = "COLABORADOR" ] && [ "$(echo "$ME" | jget "['nivel_hierarquico']")" = "None" ] && pass "setor/papel/nível NÃO mudaram (escalada bloqueada)" || fail "escalada" "$ME"
req PUT "/users/$IDD" "$TB" '{"cargo":"hack"}'; check "colab edita perfil de OUTRO usuário" 403 "$CODE"
req GET "/users/$IDB" "$TB"; check "GET /users/<meu id>" 200 "$CODE"; echo "$BODY" | grep -q '"has_picture"' && pass "GET /users/<id> devolve has_picture/has_signature" || fail "campos perfil" "$BODY"

echo "== foto e assinatura"
python3 - <<'PY'
import base64
png = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==")
open("/tmp/rb_pic.png","wb").write(png); open("/tmp/rb_fake.png","wb").write(b"isso nao e imagem")
open("/tmp/rb_big.png","wb").write(png + b"\0"*(2*1024*1024+10))
PY
up(){ curl -s -o /tmp/rb_body -w "%{http_code}" -X PATCH "$BASE/users/$1/$2" -H "Authorization: Bearer $3" -F "$2=@$4"; }
CODE=$(up "$IDB" picture "$TB" /tmp/rb_pic.png); check "colab envia foto PNG" 200 "$CODE" "$(cat /tmp/rb_body)"
CODE=$(up "$IDB" picture "$TB" /tmp/rb_fake.png); check "arquivo que não é imagem rejeitado" 400 "$CODE"
CODE=$(up "$IDB" picture "$TB" /tmp/rb_big.png); check "foto > 2 MB rejeitada" 400 "$CODE"
CODE=$(up "$IDB" picture "$TD" /tmp/rb_pic.png); check "outro usuário envia foto pra mim" 403 "$CODE"
CT=$(curl -s -o /tmp/rb_img -w "%{content_type}" "$BASE/users/$IDB/picture?token=$TD"); [ "$CT" = "image/png" ] && cmp -s /tmp/rb_img /tmp/rb_pic.png && pass "outro usuário baixa a foto (image/png, bytes iguais)" || fail "download foto" "$CT"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/users/$IDB/picture"); check "foto sem token" 401 "$CODE"
[ "$(me "$TB" | jget "['has_picture']")" = "True" ] && pass "has_picture=true" || fail "has_picture" "$(me "$TB")"
req DELETE "/users/$IDB/picture" "$TB"; check "colab remove a foto" 200 "$CODE"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/users/$IDB/picture?token=$TB"); check "foto removida -> 404" 404 "$CODE"
CODE=$(up "$IDG" signature "$TG" /tmp/rb_pic.png); check "gestor (atendimento) envia assinatura" 200 "$CODE" "$(cat /tmp/rb_body)"
CT=$(curl -s -o /dev/null -w "%{content_type}" "$BASE/users/$IDG/signature?token=$TC"); [ "$CT" = "image/png" ] && pass "cliente consegue exibir a assinatura do atendente" || fail "assinatura download" "$CT"
CODE=$(up "$IDC" signature "$TC" /tmp/rb_pic.png); check "cliente também guarda assinatura no perfil" 200 "$CODE"

echo "== assinatura na resposta do chamado"
CAT=$(curl -s "$BASE/categories/" -H "Authorization: Bearer $TA" | python3 -c "import sys,json; d=json.load(sys.stdin); print((d[0] if isinstance(d,list) else d.get('data',[{}])[0]).get('id',1))" 2>/dev/null || echo 1)
PRI=$(curl -s "$BASE/priorities/" -H "Authorization: Bearer $TA" | python3 -c "import sys,json; d=json.load(sys.stdin); print((d[0] if isinstance(d,list) else d.get('data',[{}])[0]).get('id',1))" 2>/dev/null || echo 1)
req POST /tickets/ "$TC" "{\"subject\":\"Teste assinatura\",\"description\":\"chamado de teste\",\"category_id\":$CAT,\"priority_id\":$PRI,\"user_id\":$IDC}"; check "cliente abre chamado" 201 "$CODE" "$BODY"
TK=$(echo "$BODY" | jget "['id']"); [ -z "$TK" ] && TK=$(echo "$BODY" | jget "['ticket_id']"); [ -z "$TK" ] && TK=$(echo "$BODY" | jget "['ticket']['id']")
echo "  chamado: $TK"
req POST "/tickets/$TK/messages" "$TG" '{"message":"Resposta do atendente com assinatura"}'; check "gestor responde o chamado" 201 "$CODE" "$BODY"
req POST "/tickets/$TK/messages" "$TG" '{"message":"nota interna","private":true}'; check "gestor cria nota interna" 201 "$CODE"
req POST "/tickets/$TK/messages" "$TC" '{"message":"Resposta do solicitante"}'; check "cliente responde" 201 "$CODE"
req GET "/tickets/$TK/messages" "$TC"; check "cliente lista mensagens" 200 "$CODE"
python3 - "$BODY" "$IDG" "$IDC" <<'PY'
import sys, json
msgs = json.loads(sys.argv[1]); g = int(sys.argv[2]); c = int(sys.argv[3])
ok = True
for m in msgs:
    if m["sender"] == g and not m.get("private"):
        ok &= m.get("author_has_signature") is True and m.get("author_role") == "GESTOR_PROJETO"
    if m["sender"] == c:
        ok &= m.get("author_has_signature") is True and m.get("author_role") == "CLIENTE"
print("SIG_OK" if ok and msgs else "SIG_FAIL", len(msgs))
PY
echo "  (mensagens do atendente vêm com author_has_signature/author_role — o front só mostra assinatura pra ADMIN/GESTOR_PROJETO)"

echo
echo "RESULTADO: $OK passaram, $FAIL falharam"
[ "$FAIL" = "0" ]
