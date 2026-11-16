"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Icon from "./ProfileIcon";
import styles from "../profile-dashboard.module.css";

export type GalleryFilter = "all" | "public" | "private";

type Props = {
  filter: GalleryFilter;
  onFilter: (filter: GalleryFilter) => void;
  counts: { all: number; public: number; private: number };
  videoUsed: string;
  videoLimit: string;
  videoPercent: number;
  videoTimeAction: ReactNode;
  dailyVideoDisabled: boolean;
  dailyVideoActive: boolean;
  dailyVideoUploading: boolean;
  dailyVideoHint: string;
  onDailyVideo: () => void;
  onPublicUpload: () => void;
  onPrivateUpload: () => void;
  uploading: boolean;
  children: ReactNode;
};

export default function GalleryPanel(props: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  useEffect(() => {
    if (!uploadOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [uploadOpen]);

  const chooseUpload = (upload: () => void) => {
    dialog.current?.close();
    setUploadOpen(false);
    upload();
  };

  return (
    <section
      id="galeria-perfil"
      className={styles.gallery}
      aria-labelledby="gallery-title"
    >
      <div className={styles.galleryHeading}>
        <div>
          <h2 id="gallery-title">
            Tu contenido <span>{props.counts.all}</span>
          </h2>
          <p>Tu galería, tu mejor presentación.</p>
        </div>
        <button
          type="button"
          onClick={() => setUploadOpen(true)}
          disabled={props.uploading}
          className={styles.primaryButton}
        >
          <Icon name="plus" />
          {props.uploading ? "Subiendo…" : "Subir contenido"}
        </button>
      </div>
      <div className={styles.galleryControls}>
        <div
          className={styles.filters}
          role="group"
          aria-label="Filtrar contenido"
        >
          {(
            [
              ["all", "Todo"],
              ["public", "Público"],
              ["private", "Privado"],
            ] as const
          ).map(([filter, label]) => (
            <button
              key={filter}
              type="button"
              onClick={() => props.onFilter(filter)}
              aria-pressed={props.filter === filter}
              className={props.filter === filter ? styles.selectedFilter : ""}
            >
              {label}
              <span>{props.counts[filter]}</span>
            </button>
          ))}
        </div>
        <div
          className={styles.videoQuota}
          title="Tiempo de video usado / disponible"
        >
          <Icon name="play" />
          <span>
            {props.videoUsed} <span>/ {props.videoLimit} min</span>
          </span>
          <span className={styles.quotaTrack}>
            <span
              style={{
                width: `${Math.min(100, Math.max(0, props.videoPercent))}%`,
              }}
            />
          </span>
          {props.videoTimeAction}
        </div>
      </div>
      {props.children}
      <div className={styles.dailyVideo}>
        <span className={styles.dailyIcon}>
          <Icon name="play" />
        </span>
        <div>
          <strong>
            Video del día{" "}
            {props.dailyVideoActive && (
              <span className={styles.liveLabel}>Activo</span>
            )}
          </strong>
          <p>{props.dailyVideoHint}</p>
        </div>
        <button
          id="video-del-dia"
          type="button"
          onClick={props.onDailyVideo}
          disabled={props.dailyVideoDisabled}
          title={
            props.dailyVideoDisabled && !props.dailyVideoUploading
              ? "Disponible cuando tu perfil esté aprobado y tenga foto"
              : undefined
          }
        >
          {props.dailyVideoUploading
            ? "Subiendo…"
            : props.dailyVideoActive
              ? "Reemplazar"
              : "Publicar"}
          <Icon name="arrow" />
        </button>
      </div>
      <dialog
        ref={dialog}
        className={styles.uploadDialog}
        aria-labelledby="upload-title"
        onClose={() => setUploadOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        <div className={styles.dialogHeading}>
          <h2 id="upload-title">¿Qué quieres subir?</h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => dialog.current?.close()}
          >
            <Icon name="close" />
          </button>
        </div>
        <button
          type="button"
          className={styles.uploadChoice}
          onClick={() => chooseUpload(props.onPublicUpload)}
        >
          <span className={styles.choiceIcon}>
            <Icon name="image" />
          </span>
          <span>
            <strong>Contenido público</strong>
            <small>Visible para todos, gratis.</small>
          </span>
          <Icon name="arrow" />
        </button>
        <button
          type="button"
          className={`${styles.uploadChoice} ${styles.privateChoice}`}
          onClick={() => chooseUpload(props.onPrivateUpload)}
        >
          <span className={styles.choiceIcon}>
            <Icon name="lock" />
          </span>
          <span>
            <strong>Contenido privado</strong>
            <small>Tú eliges el precio.</small>
          </span>
          <Icon name="arrow" />
        </button>
      </dialog>
    </section>
  );
}
