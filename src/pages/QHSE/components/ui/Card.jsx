import React from "react";

export const Card = ({ children, className = "", ...props }) => (
  <div className={`card ${className}`} {...props}>{children}</div>
);

export const CardHeader = ({ children, className = "" }) => (
  <div className={`card-header ${className}`}>{children}</div>
);

export const CardTitle = ({ children, className = "" }) => (
  <h3 className={`card-title ${className}`}>{children}</h3>
);

export const CardBody = ({ children, className = "" }) => (
  <div className={`card-body ${className}`}>{children}</div>
);

export const CardContent = ({ children, className = "" }) => (
  <div className={`card-content ${className}`}>{children}</div>
);