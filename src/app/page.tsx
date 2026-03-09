"use client";

import { useRef, useEffect } from "react";
import Link from "next/link";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import styles from "./landing.module.css";

gsap.registerPlugin(SplitText);

export default function Home() {
  const pageRef = useRef<HTMLDivElement>(null);
  const cornerTLRef = useRef<HTMLDivElement>(null);
  const cornerTRRef = useRef<HTMLDivElement>(null);
  const cornerBLRef = useRef<HTMLDivElement>(null);
  const cornerBRRef = useRef<HTMLDivElement>(null);
  const classificationRef = useRef<HTMLDivElement>(null);
  const ruleRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const buttonsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const corners = [
      cornerTLRef.current,
      cornerTRRef.current,
      cornerBLRef.current,
      cornerBRRef.current,
    ];

    const split = new SplitText(descriptionRef.current, { type: "chars" });

    const tl = gsap.timeline({
      defaults: { ease: "power3.out" },
      onStart: () => {
        pageRef.current?.classList.remove(styles.hidden);
      },
    });

    tl.from(corners, {
      opacity: 0,
      duration: 0.6,
    })
      .from(
        [classificationRef.current, ruleRef.current],
        { opacity: 0, y: -10, duration: 0.5 },
        "-=0.3"
      )
      .from(
        titleRef.current,
        { opacity: 0, y: 20, duration: 0.6 },
        "-=0.2"
      )
      .from(
        subtitleRef.current,
        { opacity: 0, duration: 0.5 },
        "-=0.2"
      )
      .from(
        frameRef.current,
        { opacity: 0, scale: 0.95, duration: 0.7 },
        "-=0.2"
      )
      .from(split.chars, {
        opacity: 0,
        duration: 0.02,
        stagger: 0.015,
      })
      .from(
        buttonsRef.current,
        { opacity: 0, y: 15, duration: 0.5 },
        "-=0.1"
      );

    return () => {
      split.revert();
    };
  }, []);

  return (
    <div ref={pageRef} className={`${styles.page} ${styles.hidden}`}>
      {/* Corner marks */}
      <div ref={cornerTLRef} className={styles.cornerTL} />
      <div ref={cornerTRRef} className={styles.cornerTR} />
      <div ref={cornerBLRef} className={styles.cornerBL} />
      <div ref={cornerBRRef} className={styles.cornerBR} />

      {/* Header */}
      <header className={styles.header}>
        <div ref={classificationRef} className={styles.classification}>
          Open Source Workspace
        </div>
        <div ref={ruleRef} className={styles.rule} />
        <h1 ref={titleRef} className={styles.title}>
          WATER CAUSTICS ANIME
        </h1>
        <div ref={subtitleRef} className={styles.subtitle}>
          Water caustics with object intersaction
        </div>
      </header>

      {/* Video */}
      <div ref={frameRef} className={styles.frame}>
        <video
          src="/assets/creative-boilerplate-2.mp4"
          autoPlay
          muted
          loop
          playsInline
          className={styles.video}
        />
      </div>

      {/* Description */}
      <p ref={descriptionRef} className={styles.description}>
        A pre-configured creative coding environment with Three.js, React Three
        Fiber, and Drei. Includes a 3D playground with interactive controls, GLB
        model import, and a modular overlay system — ready to build on.
      </p>

      {/* Action buttons */}
      <div ref={buttonsRef} className={styles.buttons}>
        <Link href="/playground" className={styles.btnPrimary}>
          Start Playground
        </Link>
      </div>
    </div>
  );
}
