# usage-band

Bande au-dessus du champ de saisie (app Desktop), aux couleurs d'aurora-noir.

| Segment | Ce qu'il montre |
| --- | --- |
| **Contexte** | % de la fenêtre utilisée, tokens |
| **Session 5 h** / **Semaine** | % utilisé et temps avant reset |
| **Git** | branche, `✓ propre` ou `●N ?M` (modifiés / non suivis), `↑` à pousser, `↓` à récupérer. Sans branche distante du même nom, la comparaison se fait avec `origin/main` |
| **Actions** | dernier run GitHub Actions du dépôt : `en cours 10/19` (étapes), réussi, échec |
| **PR** | PR de la branche courante : CI, review, brouillon, fusionnée |
| **Agents** | sous-agents en cours et leur description |
| **Worktree supprimable** | apparaît quand vous avez poussé pendant la session, que la branche est propre, sans commit hors de `main`, et que le run Actions suivant a réussi |

## Prérequis

`git` et la CLI `gh` (connectée : `gh auth login`) pour les segments Actions et PR. Sans `gh`, ces deux segments ne s'affichent simplement pas.

## Ce que le plugin exécute

Des lectures seulement : `git status`, `git rev-parse`, `git rev-list`, `gh pr view`, `gh run list`, `gh run view`. Il ne modifie rien et ne supprime aucun worktree : le message « supprimable » est un signal, la suppression reste à faire à la main (`git worktree remove`).
Rafraîchissement : chaque minute, après chaque commande Bash et chaque tour, toutes les 20 s tant qu'un run tourne.

## Installation

```
claude plugin marketplace add AG69075/claude-theme
claude plugin install usage-band@claude-theme
```
