BEGIN TRY

BEGIN TRAN;

-- CreateSchema
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = N'dbo') EXEC sp_executesql N'CREATE SCHEMA [dbo];';

-- CreateTable
CREATE TABLE [dbo].[TipoUsuario] (
    [id] INT NOT NULL IDENTITY(1,1),
    [descripcion] NVARCHAR(50) NOT NULL,
    CONSTRAINT [TipoUsuario_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [TipoUsuario_descripcion_key] UNIQUE NONCLUSTERED ([descripcion])
);

-- CreateTable
CREATE TABLE [dbo].[Usuario] (
    [id] INT NOT NULL IDENTITY(1,1),
    [nombre] NVARCHAR(50) NOT NULL,
    [passwordHash] CHAR(60) NOT NULL,
    [tipoUsuarioId] INT NOT NULL,
    CONSTRAINT [Usuario_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Usuario_nombre_key] UNIQUE NONCLUSTERED ([nombre])
);

-- CreateTable
CREATE TABLE [dbo].[Inmueble] (
    [id] INT NOT NULL IDENTITY(1,1),
    [staysId] NVARCHAR(50) NOT NULL,
    [direccion] NVARCHAR(200) NOT NULL,
    [precio] DECIMAL(12,2) NOT NULL,
    [capacidad] INT NOT NULL,
    [estado] NVARCHAR(20) NOT NULL CONSTRAINT [Inmueble_estado_df] DEFAULT 'ACTIVO',
    CONSTRAINT [Inmueble_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Inmueble_staysId_key] UNIQUE NONCLUSTERED ([staysId])
);

-- CreateTable
CREATE TABLE [dbo].[Huesped] (
    [id] INT NOT NULL IDENTITY(1,1),
    [staysId] NVARCHAR(50) NOT NULL,
    [apellido] NVARCHAR(100) NOT NULL,
    [nombres] NVARCHAR(100) NOT NULL,
    [dni] NVARCHAR(20),
    [nacionalidad] NVARCHAR(50),
    [confirmoInicio] BIT NOT NULL CONSTRAINT [Huesped_confirmoInicio_df] DEFAULT 0,
    [confirmoFin] BIT NOT NULL CONSTRAINT [Huesped_confirmoFin_df] DEFAULT 0,
    [telefono] NVARCHAR(30),
    [email] NVARCHAR(100),
    CONSTRAINT [Huesped_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Huesped_staysId_key] UNIQUE NONCLUSTERED ([staysId])
);

-- CreateTable
CREATE TABLE [dbo].[Reserva] (
    [id] INT NOT NULL IDENTITY(1,1),
    [staysId] NVARCHAR(50) NOT NULL,
    [fechaInicio] DATE NOT NULL,
    [horaInicio] CHAR(5) NOT NULL,
    [fechaFin] DATE NOT NULL,
    [horaFin] CHAR(5) NOT NULL,
    [titular] NVARCHAR(100) NOT NULL,
    [costoEstadia] DECIMAL(12,2),
    [costo] DECIMAL(12,2),
    [fechaCosto] DATE,
    [inmuebleId] INT NOT NULL,
    [usuarioId] INT,
    CONSTRAINT [Reserva_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Reserva_staysId_key] UNIQUE NONCLUSTERED ([staysId])
);

-- CreateTable
CREATE TABLE [dbo].[Movimiento] (
    [id] INT NOT NULL IDENTITY(1,1),
    [tipo] NVARCHAR(10) NOT NULL,
    [descripcion] NVARCHAR(500),
    [fechaRealizado] DATE,
    [horaRealizado] CHAR(5),
    [estado] NVARCHAR(20) NOT NULL CONSTRAINT [Movimiento_estado_df] DEFAULT 'PENDIENTE',
    [reservaId] INT NOT NULL,
    [usuarioId] INT,
    CONSTRAINT [Movimiento_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Movimiento_reservaId_tipo_key] UNIQUE NONCLUSTERED ([reservaId],[tipo])
);

-- CreateTable
CREATE TABLE [dbo].[Notificacion] (
    [id] INT NOT NULL IDENTITY(1,1),
    [mensaje] NVARCHAR(500) NOT NULL,
    [fecha] DATE NOT NULL,
    [hora] CHAR(5) NOT NULL,
    [leida] BIT NOT NULL CONSTRAINT [Notificacion_leida_df] DEFAULT 0,
    [movimientoId] INT NOT NULL,
    CONSTRAINT [Notificacion_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Notificacion_movimientoId_key] UNIQUE NONCLUSTERED ([movimientoId])
);

-- CreateTable
CREATE TABLE [dbo].[_HuespedToReserva] (
    [A] INT NOT NULL,
    [B] INT NOT NULL,
    CONSTRAINT [_HuespedToReserva_AB_unique] UNIQUE NONCLUSTERED ([A],[B])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [_HuespedToReserva_B_index] ON [dbo].[_HuespedToReserva]([B]);

-- AddForeignKey
ALTER TABLE [dbo].[Usuario] ADD CONSTRAINT [Usuario_tipoUsuarioId_fkey] FOREIGN KEY ([tipoUsuarioId]) REFERENCES [dbo].[TipoUsuario]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Reserva] ADD CONSTRAINT [Reserva_inmuebleId_fkey] FOREIGN KEY ([inmuebleId]) REFERENCES [dbo].[Inmueble]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Reserva] ADD CONSTRAINT [Reserva_usuarioId_fkey] FOREIGN KEY ([usuarioId]) REFERENCES [dbo].[Usuario]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Movimiento] ADD CONSTRAINT [Movimiento_reservaId_fkey] FOREIGN KEY ([reservaId]) REFERENCES [dbo].[Reserva]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Movimiento] ADD CONSTRAINT [Movimiento_usuarioId_fkey] FOREIGN KEY ([usuarioId]) REFERENCES [dbo].[Usuario]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Notificacion] ADD CONSTRAINT [Notificacion_movimientoId_fkey] FOREIGN KEY ([movimientoId]) REFERENCES [dbo].[Movimiento]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[_HuespedToReserva] ADD CONSTRAINT [_HuespedToReserva_A_fkey] FOREIGN KEY ([A]) REFERENCES [dbo].[Huesped]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[_HuespedToReserva] ADD CONSTRAINT [_HuespedToReserva_B_fkey] FOREIGN KEY ([B]) REFERENCES [dbo].[Reserva]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

