-- Customer.identificationType se guarda siempre como código SRI (tabla 6 de la ficha técnica).
-- La web guardaba el nombre (CEDULA, RUC…) y la API / el POS / la importación el código, así que
-- había de los dos. Solo datos: el esquema no cambia y el código anterior ya entendía los códigos.
UPDATE "customers"
SET "identificationType" = CASE upper(trim("identificationType"))
    WHEN 'RUC' THEN '04'
    WHEN 'CEDULA' THEN '05'
    WHEN 'PASAPORTE' THEN '06'
    WHEN 'CONSUMIDOR_FINAL' THEN '07'
    WHEN 'IDENTIFICACION_EXTERIOR' THEN '08'
  END
WHERE upper(trim("identificationType")) IN
  ('RUC', 'CEDULA', 'PASAPORTE', 'CONSUMIDOR_FINAL', 'IDENTIFICACION_EXTERIOR');
