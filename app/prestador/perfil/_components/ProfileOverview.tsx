import Image from "next/image";
import Link from "next/link";
import type { ChangeEventHandler, ReactNode } from "react";
import Icon from "./ProfileIcon";
import styles from "../profile-dashboard.module.css";

type Props = {
  name: string;
  photoUrl: string;
  location: string;
  price: string;
  uploadingPhoto: boolean;
  editMode: boolean;
  onPhotoChange: ChangeEventHandler<HTMLInputElement>;
  onPhotoOpen: () => void;
  onEdit: () => void;
  status: string;
  statusDetail: string;
  statusTone: "ok" | "error" | "warning";
  subscription: string;
  subscriptionOk: boolean;
  onRecharge: () => void;
  views: string;
  income: string;
  badge: ReactNode;
  verificationLabel: string;
  verificationDisabled: boolean;
  onVerification: () => void;
  promotionActive: boolean;
  promotionDisabled: boolean;
  promotionHint: string;
  onPromote: () => void;
  onInvite: () => void;
  paused: boolean;
  pauseDisabled: boolean;
  onPause: () => void;
  children: ReactNode;
};

export default function ProfileOverview(props: Props) {
  return (
    <>
      <div className={styles.pageHeading}>
        <div>
          <p className={styles.eyebrow}>TU ESPACIO EN BELACLUB</p>
          <h1>Mi perfil</h1>
        </div>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={props.onEdit}
          aria-expanded={props.editMode}
          aria-controls="datos-publicos"
        >
          <Icon name={props.editMode ? "close" : "edit"} />
          {props.editMode ? "Cerrar edición" : "Editar perfil"}
        </button>
      </div>
      <div className={styles.profileCard}>
        <div className={styles.overview}>
          <div className={styles.identity}>
            <div className={styles.avatarGroup}>
              {props.photoUrl ? (
                <button
                  type="button"
                  className={styles.avatar}
                  onClick={props.onPhotoOpen}
                  aria-label="Ver foto principal"
                >
                  <Image
                    src={props.photoUrl}
                    alt="Foto principal del perfil"
                    fill
                    sizes="96px"
                    priority
                    className="object-cover"
                  />
                </button>
              ) : (
                <label className={`${styles.avatar} ${styles.avatarEmpty}`}>
                  <Icon name="image" />
                  <span>
                    {props.uploadingPhoto ? "Subiendo…" : "Subir foto"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={props.uploadingPhoto}
                    onChange={props.onPhotoChange}
                    aria-label="Subir foto principal"
                  />
                </label>
              )}
              {props.editMode && props.photoUrl && (
                <label className={styles.changePhoto}>
                  {props.uploadingPhoto ? "Subiendo…" : "Cambiar foto"}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={props.uploadingPhoto}
                    onChange={props.onPhotoChange}
                    aria-label="Cambiar foto principal"
                  />
                </label>
              )}
            </div>
            <div className={styles.identityInfo}>
              <span
                className={`${styles.status} ${styles[props.statusTone]}`}
                title={props.statusDetail}
              >
                <i />
                {props.status}
              </span>
              <h2>{props.name || "Tu perfil"}</h2>
              <div className={styles.meta}>
                {props.location && (
                  <span>
                    <Icon name="location" />
                    {props.location}
                  </span>
                )}
                {props.price && (
                  <span className={styles.price}>
                    {props.price}
                    <small> COP</small>
                  </span>
                )}
              </div>
              {props.badge}
            </div>
          </div>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.statIcon}>
                <Icon name="eye" />
              </span>
              <span className={styles.statLabel}>Visitas al perfil</span>
              <strong>{props.views}</strong>
            </div>
            <Link
              href="/prestador/dinero"
              className={`${styles.stat} ${styles.earnings}`}
            >
              <span className={styles.statIcon}>
                <Icon name="wallet" />
              </span>
              <span className={styles.statLabel}>Ingresos privados</span>
              <strong>{props.income}</strong>
              <Icon name="arrow" className={styles.statArrow} />
            </Link>
          </div>
        </div>
        <div className={styles.toolbar}>
          <div className={styles.tools}>
            <button
              type="button"
              onClick={props.onVerification}
              disabled={props.verificationDisabled}
              className={styles.verifyButton}
            >
              <Icon name="shield" />
              {props.verificationLabel}
            </button>
            <button
              type="button"
              onClick={props.onPromote}
              disabled={props.promotionDisabled}
              title={props.promotionHint}
            >
              <Icon name="boost" />
              {props.promotionActive ? "Extender promoción" : "Promocionar"}
            </button>
            <button type="button" onClick={props.onInvite}>
              <Icon name="invite" />
              Invitar y ganar
            </button>
            <button
              type="button"
              onClick={props.onPause}
              disabled={props.pauseDisabled}
              title={
                props.pauseDisabled
                  ? "Disponible con tu perfil aprobado"
                  : undefined
              }
            >
              <Icon name={props.paused ? "play" : "pause"} />
              {props.paused ? "Reactivar" : "Pausar"}
            </button>
          </div>
          <button
            type="button"
            onClick={props.onRecharge}
            className={`${styles.plan} ${props.subscriptionOk ? styles.planActive : ""}`}
            title={`${props.subscription}. Recargar saldo`}
          >
            <i />
            {props.subscription}
            <Icon name="arrow" />
          </button>
        </div>
        {props.children}
      </div>
    </>
  );
}
