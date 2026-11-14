# claude-theme

Thèmes personnalisés (mods) pour Claude Code Desktop.

## aurora-noir

Une aurore boréale très sombre : rubans vert menthe et violet discrets, animés lentement, sur un fond presque noir (#05070d). Les couleurs de l'interface suivent la même palette, avec un accent vert menthe. Thème sombre uniquement, pour l'app Desktop.

### Installation

```
claude plugin marketplace add AG69075/claude-theme
claude plugin install aurora-noir@claude-theme
```

Puis `/reload-plugins` (ou redémarrer la session). Si un autre thème est actif sur le projet, `/custom-theme off` le retire.

### Désinstallation

```
claude plugin uninstall aurora-noir@claude-theme
```

## usage-band

Bande au-dessus du prompt : Contexte, Cache (compte à rebours), Session 5 h, Semaine avec temps de reset. Couleurs d'aurora-noir. Voir [plugins/usage-band](plugins/usage-band/README.md).

```
claude plugin install usage-band@claude-theme
```
