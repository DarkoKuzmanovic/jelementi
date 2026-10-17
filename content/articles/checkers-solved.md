---
title: Checkers, Solved
slug: checkers-solved
excerpt: In 2007, a team proved that perfect play in checkers ends in a draw. The proof did not store every possible game; it joined exact endgame results to a selective search from the opening.
publishedAt: 2026-10-17
updatedAt: 2026-10-17
status: published
category: Inventions
tags:
  - games
  - computers
  - mathematics
  - checkers
author: Jelementi
cover:
  src: articles/checkers-solved/cover-v1.png
  alt: Lenka, in a cream sweater and round glasses, rests her chin on her hand and smiles at a wooden checkers board with red and black pieces, in a sunlit university computer lab with beige computers and bookshelves.
audio:
  src: articles/checkers-solved/narration-midnight-storyteller-2-v1.mp3
  durationSeconds: 379
references:
  - title: "[1] Checkers Is Solved"
    url: https://www.science.org/doi/10.1126/science.1144079
  - title: "[2] Solving Checkers"
    url: https://www.ijcai.org/Proceedings/05/Papers/0515.pdf
  - title: "[3] Chinook Project Milestones"
    url: https://webdocs.cs.ualberta.ca/~chinook/project/milestones.html
  - title: "[4] Chinook: The World Man-Machine Checkers Champion"
    url: https://webdocs.cs.ualberta.ca/~jonathan/publications/ai_publications/aimag96.pdf
  - title: "[5] One Jump Ahead: Computer Perfection at Checkers"
    url: https://link.springer.com/book/10.1007/978-0-387-76576-1
  - title: "[6] Checkers"
    url: https://www.britannica.com/topic/checkers
  - title: "[7] Two-person constant-sum games"
    url: https://www.britannica.com/science/game-theory/Two-person-constant-sum-games
  - title: "[8] Deep Blue"
    url: https://kids.britannica.com/scholars/article/Deep-Blue/472185
---
Set twelve pieces for each side on the dark squares of a sixty-four-square board. The pieces move diagonally; a checker that reaches the far row becomes a king, and a capture is compulsory. The rules fit in a few lines. The number of possible positions does not. [[6]](https://www.britannica.com/topic/checkers)

In 2007, Jonathan Schaeffer and his University of Alberta colleagues announced in *Science* that checkers had been solved: with perfect play from both sides, the game is a draw. The paper gives the scale as roughly five hundred billion billion possible positions, or five times ten to the twentieth. The project had begun in 1989, and dozens of computers had worked on it almost continuously. [[1]](https://www.science.org/doi/10.1126/science.1144079)

“Solved” has a narrower meaning here than a complete catalogue of every board. In game theory, a weak solution establishes the result from the starting position and a strategy that achieves it. A strong solution gives the value of every possible position, with a strategy for each. The 2007 result was a weak solution: from the start, either side can hold the draw. It was not a strong solution of every position in checkers. [[1]](https://www.science.org/doi/10.1126/science.1144079)[[2]](https://www.ijcai.org/Proceedings/05/Papers/0515.pdf)

That distinction is easy to miss because the team did build an enormous catalogue. Working backward from the ends of games, the researchers computed exact win, loss or draw values for every position with ten or fewer pieces on the board. The database held 39,271,258,813,439 positions, about thirty-nine trillion. It recorded only win, loss or draw, not the number of moves to reach the result; a custom compression method packed the tables into 237 gigabytes, averaging 154 positions per byte. These were exact endgame answers, not predictions from a program’s evaluation score. [[1]](https://www.science.org/doi/10.1126/science.1144079)[[3]](https://webdocs.cs.ualberta.ca/~chinook/project/milestones.html)

The backward calculation is called retrograde analysis. Start with positions where the game is over, then work back. From the player-to-move’s perspective, a position is a win if a move hands the loss to the opponent; it is a loss if every move gives the opponent a win; other positions may be draws. Checkers’ forced captures help shrink the board, so a search from the opening can eventually reach a position whose exact answer is already in the database. [[1]](https://www.science.org/doi/10.1126/science.1144079)[[2]](https://www.ijcai.org/Proceedings/05/Papers/0515.pdf)

But the endgame files were only one part of the proof. A proof-tree manager searched forward from the opening, choosing positions that needed more work. Two search programs tested those positions, while the manager combined their results with the known endgame values. Human checkers analysis supplied a promising line to investigate first. The search did not need to visit every position in the game; it needed enough verified branches to show that neither side could force a win. [[1]](https://www.science.org/doi/10.1126/science.1144079)[[2]](https://www.ijcai.org/Proceedings/05/Papers/0515.pdf)

Tournament checkers usually avoids the standard opening because expert games from it tended to repeat. Instead, the first three moves are selected by ballot. The team proved the draw through nineteen three-move openings. There were roughly three hundred possible sequences, but more than a hundred were duplicates reached by different move orders, and search could rule out others as irrelevant. The proof was a carefully trimmed argument, not a lookup table containing five hundred billion billion entries. [[1]](https://www.science.org/doi/10.1126/science.1144079)[[6]](https://www.britannica.com/topic/checkers)

Chinook had not started out as a theorem prover. The University of Alberta project began in 1989 with the more immediate ambition of building a program strong enough to challenge the world champion. The milestones show the turn from competition to proof: the team completed its ten-piece endgame databases in 2005, then announced the solution two years later. [[3]](https://webdocs.cs.ualberta.ca/~chinook/project/milestones.html)

The champion was Marion Tinsley, whose record made the challenge unusually severe. Chinook placed second to him at the 1990 U.S. Championship, earning the right to challenge. Their title match came in London in 1992: Tinsley beat Chinook four games to two, with thirty-three draws. Schaeffer and colleagues wrote in 1996 that the match’s two Chinook wins were only the sixth and seventh times Tinsley had lost in forty-two years. The computer had become a world-class opponent; it had not yet shown that it could never lose. [[4]](https://webdocs.cs.ualberta.ca/~jonathan/publications/ai_publications/aimag96.pdf)

They played again in 1994. The first six games were all draws. Before the seventh, Tinsley withdrew for health reasons, and Chinook was declared champion under the match rules. That was not a win over Tinsley. In 1995, Chinook did beat another top player, Don Lafferty, by one game to none, with thirty-one draws. The distinction matters: a machine can defeat people without knowing the perfect result of the game. [[3]](https://webdocs.cs.ualberta.ca/~chinook/project/milestones.html)[[4]](https://webdocs.cs.ualberta.ca/~jonathan/publications/ai_publications/aimag96.pdf)

Schaeffer later told the longer story in *One Jump Ahead: Computer Perfection at Checkers*. The revised edition reaches the ending the first edition could not: after years spent making Chinook stronger than human opponents, the team had used the program and its databases to prove what neither match result could establish. [[5]](https://link.springer.com/book/10.1007/978-0-387-76576-1)

Chess makes the difference clearer. Deep Blue’s 1997 match victory over Garry Kasparov showed that a computer could beat the reigning world champion, not that anyone had computed the perfect-play result of chess. The *Science* paper explicitly contrasted heuristic game-playing programs such as Deep Blue with a proof that replaces estimates with exact results. Britannica describes chess as theoretically determined but so large that finding its result remains beyond foreseeable computation. [[1]](https://www.science.org/doi/10.1126/science.1144079)[[7]](https://www.britannica.com/science/game-theory/Two-person-constant-sum-games)[[8]](https://kids.britannica.com/scholars/article/Deep-Blue/472185)

Checkers was solved in the useful but limited sense: from the starting position, perfect play can preserve a draw. The theorem leaves human games where they were. Miss a compulsory jump and it cannot help you.
